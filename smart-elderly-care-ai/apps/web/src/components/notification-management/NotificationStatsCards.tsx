import React from 'react';
import { Bell, CheckCircle2, Clock, FileEdit, RotateCcw } from 'lucide-react';

interface NotificationStats {
  total: number;
  published: number;
  scheduled: number;
  draft: number;
  revoked: number;
  totalDelivered: number;
}

interface NotificationStatsCardsProps {
  stats: NotificationStats;
}

export const NotificationStatsCards: React.FC<NotificationStatsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
      {/* Card 1: Tổng thông báo */}
      <div className="glass-card p-5 group hover:border-[#F05A24]/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#737780] dark:text-[#A1A7B1]">
            Tổng thông báo
          </span>
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/30 shadow-2xs">
            <Bell className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2">
          <span className="font-mono text-2xl font-extrabold text-[#191B20] dark:text-[#F1F3F7]">
            {stats.total}
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#E7E9ED] dark:border-[#323846]">
          <p className="text-[11px] text-[#737780] dark:text-[#A1A7B1] truncate">
            Toàn bộ lịch sử thông báo
          </p>
        </div>
      </div>

      {/* Card 2: Đã phát hành */}
      <div className="glass-card p-5 group hover:border-[#F05A24]/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#737780] dark:text-[#A1A7B1]">
            Đã phát hành
          </span>
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/30 shadow-2xs">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2">
          <span className="font-mono text-2xl font-extrabold text-[#16A36A]">
            {stats.published}
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#E7E9ED] dark:border-[#323846]">
          <p className="text-[11px] text-[#737780] dark:text-[#A1A7B1] truncate">
            Đang hiển thị trên ứng dụng
          </p>
        </div>
      </div>

      {/* Card 3: Đã lên lịch */}
      <div className="glass-card p-5 group hover:border-[#F05A24]/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#737780] dark:text-[#A1A7B1]">
            Đã lên lịch
          </span>
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/30 shadow-2xs">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2">
          <span className="font-mono text-2xl font-extrabold text-[#E9A23B]">
            {stats.scheduled}
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#E7E9ED] dark:border-[#323846]">
          <p className="text-[11px] text-[#737780] dark:text-[#A1A7B1] truncate">
            Chờ đến giờ phát hành
          </p>
        </div>
      </div>

      {/* Card 4: Bản nháp */}
      <div className="glass-card p-5 group hover:border-[#F05A24]/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#737780] dark:text-[#A1A7B1]">
            Bản nháp
          </span>
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/30 shadow-2xs">
            <FileEdit className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2">
          <span className="font-mono text-2xl font-extrabold text-[#191B20] dark:text-[#F1F3F7]">
            {stats.draft}
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#E7E9ED] dark:border-[#323846]">
          <p className="text-[11px] text-[#737780] dark:text-[#A1A7B1] truncate">
            Chưa gửi ra hệ thống
          </p>
        </div>
      </div>

      {/* Card 5: Đã thu hồi */}
      <div className="glass-card p-5 group hover:border-[#F05A24]/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#737780] dark:text-[#A1A7B1]">
            Đã thu hồi
          </span>
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/30 shadow-2xs">
            <RotateCcw className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2">
          <span className="font-mono text-2xl font-extrabold text-[#E5484D]">
            {stats.revoked}
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#E7E9ED] dark:border-[#454A53]">
          <p className="text-[11px] text-[#737780] dark:text-[#A1A7B1] truncate">
            Đã hủy và ẩn khỏi App
          </p>
        </div>
      </div>
    </div>
  );
};

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
      <div className="glass-card p-5 relative group">
        <div className="flex items-center justify-between relative z-10 px-1">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Tổng thông báo
          </span>
          <div className="p-2 rounded-xl bg-[#FFF8EE] dark:bg-[#1A3830] text-[#D96C3B] dark:text-[#DFB15B] border border-[#C8AD8A] dark:border-[#2F5A4D] shadow-sm">
            <Bell className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2 px-1 relative z-10">
          <span className="font-mono text-2xl font-black text-slate-900 dark:text-white">
            {stats.total}
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-white/5 px-1 relative z-10">
          <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
            Toàn bộ lịch sử thông báo
          </p>
        </div>
      </div>

      {/* Card 2: Đã phát hành */}
      <div className="glass-card p-5 relative group">
        <div className="flex items-center justify-between relative z-10 px-1">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Đã phát hành
          </span>
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-sm">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2 px-1 relative z-10">
          <span className="font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {stats.published}
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-white/5 px-1 relative z-10">
          <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
            Đang hiển thị trên App
          </p>
        </div>
      </div>

      {/* Card 3: Đã lên lịch */}
      <div className="glass-card p-5 relative group">
        <div className="flex items-center justify-between relative z-10 px-1">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Đã lên lịch
          </span>
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-sm">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2 px-1 relative z-10">
          <span className="font-mono text-2xl font-black text-amber-700 dark:text-amber-400">
            {stats.scheduled}
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-white/5 px-1 relative z-10">
          <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
            Chờ đến giờ phát hành
          </p>
        </div>
      </div>

      {/* Card 4: Bản nháp */}
      <div className="glass-card p-5 relative group">
        <div className="flex items-center justify-between relative z-10 px-1">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Bản nháp
          </span>
          <div className="p-2 rounded-xl bg-[#FFF8EE] dark:bg-[#1A3830] text-[#B08D57] dark:text-[#DFB15B] border border-[#C8AD8A] dark:border-[#2F5A4D] shadow-sm">
            <FileEdit className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2 px-1 relative z-10">
          <span className="font-mono text-2xl font-black text-slate-700 dark:text-slate-300">
            {stats.draft}
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-white/5 px-1 relative z-10">
          <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
            Đang biên soạn
          </p>
        </div>
      </div>

      {/* Card 5: Đã thu hồi */}
      <div className="glass-card p-5 relative group">
        <div className="flex items-center justify-between relative z-10 px-1">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Đã thu hồi
          </span>
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-sm">
            <RotateCcw className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline space-x-2 px-1 relative z-10">
          <span className="font-mono text-2xl font-black text-rose-700 dark:text-rose-400">
            {stats.revoked}
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-white/5 px-1 relative z-10">
          <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
            Đã hủy hoặc thu hồi
          </p>
        </div>
      </div>
    </div>
  );
};


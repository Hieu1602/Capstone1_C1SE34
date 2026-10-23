import React from 'react';
import {
  Users,
  Shield,
  Stethoscope,
  Home,
  HeartHandshake,
  Heart,
} from 'lucide-react';

interface UserStats {
  total: number;
  active: number;
  admins: number;
  doctors: number;
  owners: number;
  members: number;
  elderly: number;
}

interface UserStatsCardsProps {
  stats: UserStats;
}

export const UserStatsCards: React.FC<UserStatsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {/* Card 1: Tổng tài khoản */}
      <div className="glass-card p-4 relative group">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Tổng tài khoản
          </span>
          <Users className="w-4 h-4 text-[#D96C3B]" />
        </div>
        <div className="mt-2.5 font-mono text-2xl font-black text-slate-900 dark:text-white">
          {stats.total}
        </div>
        <div className="text-[10px] text-emerald-600 font-semibold mt-1">
          {stats.active} đang hoạt động
        </div>
      </div>

      {/* Card 2: Quản trị viên */}
      <div className="glass-card p-4 relative group">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
            Quản trị viên
          </span>
          <Shield className="w-4 h-4 text-purple-500" />
        </div>
        <div className="mt-2.5 font-mono text-2xl font-black text-purple-700 dark:text-purple-300">
          {stats.admins}
        </div>
        <div className="text-[10px] text-slate-500 mt-1">Toàn quyền hệ thống</div>
      </div>

      {/* Card 3: Bác sĩ */}
      <div className="glass-card p-4 relative group">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            Bác sĩ
          </span>
          <Stethoscope className="w-4 h-4 text-sky-500" />
        </div>
        <div className="mt-2.5 font-mono text-2xl font-black text-sky-700 dark:text-sky-300">
          {stats.doctors}
        </div>
        <div className="text-[10px] text-slate-500 mt-1">Y tế & Kê đơn thuốc</div>
      </div>

      {/* Card 4: Chủ nhà (Owner) */}
      <div className="glass-card p-4 relative group border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            Chủ nhà (Owner)
          </span>
          <Home className="w-4 h-4 text-amber-600" />
        </div>
        <div className="mt-2.5 font-mono text-2xl font-black text-amber-800 dark:text-amber-300">
          {stats.owners}
        </div>
        <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
          Quản trị căn nhà & IoT
        </div>
      </div>

      {/* Card 5: Thành viên (Member) */}
      <div className="glass-card p-4 relative group border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
            Thành viên (Member)
          </span>
          <HeartHandshake className="w-4 h-4 text-blue-600" />
        </div>
        <div className="mt-2.5 font-mono text-2xl font-black text-blue-800 dark:text-blue-300">
          {stats.members}
        </div>
        <div className="text-[10px] text-blue-700 dark:text-blue-400 mt-1">
          Gia đình & Người thân
        </div>
      </div>

      {/* Card 6: Người cao tuổi */}
      <div className="glass-card p-4 relative group">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Người cao tuổi
          </span>
          <Heart className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="mt-2.5 font-mono text-2xl font-black text-emerald-700 dark:text-emerald-300">
          {stats.elderly}
        </div>
        <div className="text-[10px] text-emerald-600 font-semibold mt-1">
          Đeo vòng BLE & SOS
        </div>
      </div>
    </div>
  );
};


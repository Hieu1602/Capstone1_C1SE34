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
      <div className="glass-card p-4 group hover:border-[#F05A24]/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#737780] dark:text-[#A1A7B1]">
            Tổng tài khoản
          </span>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/40 flex items-center justify-center shadow-sm">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5 font-mono text-2xl font-extrabold text-[#191B20] dark:text-[#F5F6F8]">
          {stats.total}
        </div>
        <div className="text-[10px] text-[#16A36A] font-semibold mt-1">
          {stats.active} đang hoạt động
        </div>
      </div>

      {/* Card 2: Quản trị viên */}
      <div className="glass-card p-4 group hover:border-[#F05A24]/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#737780] dark:text-[#A1A7B1]">
            Quản trị viên
          </span>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/40 flex items-center justify-center shadow-sm">
            <Shield className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5 font-mono text-2xl font-extrabold text-[#191B20] dark:text-[#F5F6F8]">
          {stats.admins}
        </div>
        <div className="text-[10px] text-[#737780] dark:text-[#A1A7B1] mt-1">Toàn quyền hệ thống</div>
      </div>

      {/* Card 3: Bác sĩ */}
      <div className="glass-card p-4 group hover:border-[#F05A24]/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#737780] dark:text-[#A1A7B1]">
            Bác sĩ
          </span>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/40 flex items-center justify-center shadow-sm">
            <Stethoscope className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5 font-mono text-2xl font-extrabold text-[#191B20] dark:text-[#F5F6F8]">
          {stats.doctors}
        </div>
        <div className="text-[10px] text-[#737780] dark:text-[#A1A7B1] mt-1">Y tế & Giám sát</div>
      </div>

      {/* Card 4: Chủ nhà (Owner) */}
      <div className="glass-card p-4 group hover:border-[#F05A24]/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#737780] dark:text-[#A1A7B1]">
            Chủ nhà (Owner)
          </span>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/40 flex items-center justify-center shadow-sm">
            <Home className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5 font-mono text-2xl font-extrabold text-[#191B20] dark:text-[#F5F6F8]">
          {stats.owners}
        </div>
        <div className="text-[10px] text-[#737780] dark:text-[#A1A7B1] mt-1">
          Quản trị căn hộ & IoT
        </div>
      </div>

      {/* Card 5: Thành viên (Member) */}
      <div className="glass-card p-4 group hover:border-[#F05A24]/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#737780] dark:text-[#A1A7B1]">
            Thành viên
          </span>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/40 flex items-center justify-center shadow-sm">
            <HeartHandshake className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5 font-mono text-2xl font-extrabold text-[#191B20] dark:text-[#F5F6F8]">
          {stats.members}
        </div>
        <div className="text-[10px] text-[#737780] dark:text-[#A1A7B1] mt-1">
          Gia đình & Người thân
        </div>
      </div>

      {/* Card 6: Người cao tuổi */}
      <div className="glass-card p-4 group hover:border-[#F05A24]/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#737780] dark:text-[#A1A7B1]">
            Người cao tuổi
          </span>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/40 flex items-center justify-center shadow-sm">
            <Heart className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5 font-mono text-2xl font-extrabold text-[#191B20] dark:text-[#F5F6F8]">
          {stats.elderly}
        </div>
        <div className="text-[10px] text-[#737780] dark:text-[#A1A7B1] mt-1">Theo dõi AI sinh hiệu</div>
      </div>
    </div>
  );
};

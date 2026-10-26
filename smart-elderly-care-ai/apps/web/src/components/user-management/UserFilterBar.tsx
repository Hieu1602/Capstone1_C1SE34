import React from 'react';
import { Search, Filter } from 'lucide-react';

interface UserFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedRole: string;
  onRoleChange: (value: string) => void;
  totalUsers: number;
  stats: {
    admins: number;
    doctors: number;
    owners: number;
    members: number;
    elderly: number;
  };
}

export const UserFilterBar: React.FC<UserFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedRole,
  onRoleChange,
  totalUsers,
  stats,
}) => {
  return (
    <div className="glass-card p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
      {/* Ô tìm kiếm người dùng & Bộ lọc vai trò (Dropdown) */}
      <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto flex-1 max-w-2xl">
        <div className="relative w-full sm:flex-1">
          <Search className="w-4 h-4 text-[#737780] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm theo họ tên, số điện thoại, căn hộ..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-[#F5F6F8] dark:bg-[#202329] border border-[#E7E9ED] dark:border-[#454A53] text-[#191B20] dark:text-[#F5F6F8] placeholder:text-[#737780] dark:placeholder:text-[#727984] focus:outline-none focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35]/30 transition-all font-sans"
          />
        </div>

        {/* Dropdown Lọc Vai trò */}
        <div className="relative w-full sm:w-auto shrink-0">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#737780]">
            <Filter className="w-3.5 h-3.5" />
          </div>
          <select
            value={selectedRole}
            onChange={(e) => onRoleChange(e.target.value)}
            className="w-full sm:w-auto pl-8 pr-7 py-2 rounded-xl text-xs font-semibold bg-[#F5F6F8] dark:bg-[#202329] border border-[#E7E9ED] dark:border-[#454A53] text-[#191B20] dark:text-[#F5F6F8] focus:outline-none focus:border-[#FF6B35] transition-all cursor-pointer shadow-2xs appearance-none font-sans"
          >
            <option value="all">Tất cả vai trò ({totalUsers})</option>
            <option value="admin">Quản trị viên ({stats.admins})</option>
            <option value="doctor">Bác sĩ chuyên khoa ({stats.doctors})</option>
            <option value="owner">Chủ nhà / Owner ({stats.owners})</option>
            <option value="member">Thành viên / Member ({stats.members})</option>
            <option value="elderly">Người cao tuổi ({stats.elderly})</option>
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#737780] text-[10px]">
            ▼
          </div>
        </div>
      </div>

      {/* Bộ lọc phân loại vai trò (Quick Tabs) */}
      <div className="flex items-center space-x-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
        <button
          onClick={() => onRoleChange('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono whitespace-nowrap transition-all cursor-pointer ${
            selectedRole === 'all'
              ? 'bg-[#FF6B35] text-white shadow-sm font-bold'
              : 'btn-ghost py-1.5 px-3 text-xs'
          }`}
        >
          Tất cả ({totalUsers})
        </button>
        <button
          onClick={() => onRoleChange('admin')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono whitespace-nowrap transition-all cursor-pointer ${
            selectedRole === 'admin'
              ? 'bg-purple-600 text-white shadow-sm font-bold'
              : 'btn-ghost py-1.5 px-3 text-xs'
          }`}
        >
          Admin ({stats.admins})
        </button>
        <button
          onClick={() => onRoleChange('doctor')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono whitespace-nowrap transition-all cursor-pointer ${
            selectedRole === 'doctor'
              ? 'bg-sky-600 text-white shadow-sm font-bold'
              : 'btn-ghost py-1.5 px-3 text-xs'
          }`}
        >
          Bác sĩ ({stats.doctors})
        </button>
        <button
          onClick={() => onRoleChange('owner')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono whitespace-nowrap transition-all cursor-pointer ${
            selectedRole === 'owner'
              ? 'bg-[#FF6B35] text-white shadow-sm font-bold'
              : 'btn-ghost py-1.5 px-3 text-xs'
          }`}
        >
          Chủ nhà ({stats.owners})
        </button>
        <button
          onClick={() => onRoleChange('member')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono whitespace-nowrap transition-all cursor-pointer ${
            selectedRole === 'member'
              ? 'bg-blue-600 text-white shadow-sm font-bold'
              : 'btn-ghost py-1.5 px-3 text-xs'
          }`}
        >
          Thành viên ({stats.members})
        </button>
        <button
          onClick={() => onRoleChange('elderly')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono whitespace-nowrap transition-all cursor-pointer ${
            selectedRole === 'elderly'
              ? 'bg-rose-600 text-white shadow-sm font-bold'
              : 'btn-ghost py-1.5 px-3 text-xs'
          }`}
        >
          Người cao tuổi ({stats.elderly})
        </button>
      </div>
    </div>
  );
};

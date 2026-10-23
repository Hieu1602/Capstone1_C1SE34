import React from 'react';
import { Search } from 'lucide-react';
import { SystemRole } from './types';
import { User } from '../../types';

interface RoleMembersTabProps {
  currentRole: SystemRole;
  users: User[];
  memberSearchQuery: string;
  onSearchChange: (query: string) => void;
  memberRoleFilter: string;
  onFilterChange: (filter: string) => void;
}

export const RoleMembersTab: React.FC<RoleMembersTabProps> = ({
  currentRole,
  users,
  memberSearchQuery,
  onSearchChange,
  memberRoleFilter,
  onFilterChange,
}) => {
  // Lọc tài khoản theo role filter và search text
  const filteredMembers = users.filter((u) => {
    // Lọc theo bộ chọn vai trò
    if (memberRoleFilter === 'current') {
      if (currentRole.target_role === 'user' && u.role !== 'user' && (u.role as string) !== 'owner') return false;
      if (currentRole.target_role === 'caregiver' && u.role !== 'caregiver' && (u.role as string) !== 'member') return false;
      if (currentRole.target_role !== 'user' && currentRole.target_role !== 'caregiver' && u.role !== currentRole.target_role) return false;
    } else if (memberRoleFilter !== 'all') {
      if (memberRoleFilter === 'owner' && u.role !== 'user' && (u.role as string) !== 'owner') return false;
      if (memberRoleFilter === 'member' && u.role !== 'caregiver' && (u.role as string) !== 'member') return false;
      if (memberRoleFilter !== 'owner' && memberRoleFilter !== 'member' && u.role !== memberRoleFilter) return false;
    }

    // Lọc theo tìm kiếm từ khóa
    const q = memberSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.phone.includes(q) ||
      (u.assigned_house && u.assigned_house.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header thanh lọc & tìm kiếm thành viên */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-700 dark:text-[#F5F6F8]">
          Danh sách tài khoản ({filteredMembers.length})
        </span>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Tìm kiếm thành viên */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={memberSearchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm tên, SĐT, nhà..."
              className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-[#202329] border border-slate-200 dark:border-[#454A53] text-slate-900 dark:text-[#F5F6F8] placeholder-slate-400 dark:placeholder-[#727984] focus:outline-none focus:ring-1 focus:ring-[#FF6B35]/40 font-sans"
            />
          </div>

          {/* Bộ lọc tài khoản theo vai trò */}
          <div className="relative">
            <select
              value={memberRoleFilter}
              onChange={(e) => onFilterChange(e.target.value)}
              className="w-full sm:w-auto px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-[#202329] border border-slate-200 dark:border-[#454A53] text-slate-800 dark:text-[#F5F6F8] focus:outline-none focus:ring-1 focus:ring-[#FF6B35]/40 cursor-pointer font-sans"
            >
              <option value="current">Chỉ vai trò này ({currentRole.name})</option>
              <option value="all">Tất cả tài khoản ({users.length})</option>
              <option value="admin">Quản trị viên</option>
              <option value="doctor">Bác sĩ chuyên khoa</option>
              <option value="owner">Chủ nhà (Owner)</option>
              <option value="member">Thành viên gia đình</option>
              <option value="elderly">Người cao tuổi</option>
            </select>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-[#454A53] border border-slate-200 dark:border-[#454A53] rounded-xl overflow-hidden bg-slate-50/50 dark:bg-[#17191E] max-h-[420px] overflow-y-auto">
        {filteredMembers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Không tìm thấy tài khoản nào phù hợp với bộ lọc vai trò này
          </div>
        ) : (
          filteredMembers.map((userItem) => (
            <div
              key={userItem.id}
              className="p-3 sm:px-4 flex items-center justify-between hover:bg-slate-100/70 dark:hover:bg-[#202329]"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs"
                  style={{ backgroundColor: currentRole.color }}
                >
                  {userItem.full_name.charAt(0)}
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-[#F5F6F8] block">
                    {userItem.full_name}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {userItem.phone}
                  </span>
                </div>
              </div>

              <span className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-slate-200/80 dark:bg-[#202329] text-slate-700 dark:text-[#A1A7B1]">
                {userItem.assigned_house || 'Chưa phân bổ'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};


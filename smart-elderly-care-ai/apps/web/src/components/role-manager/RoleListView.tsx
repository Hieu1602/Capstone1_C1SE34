import React from 'react';
import {
  Shield,
  Search,
  Plus,
  Lock,
  Eye,
  Edit2,
  MoreVertical,
  Trash2,
  Copy,
  Users,
} from 'lucide-react';
import { SystemRole } from './types';
import { User } from '../../types';

interface RoleListViewProps {
  roles: SystemRole[];
  users: User[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCreateNewRole: () => void;
  onInspectRole: (role: SystemRole) => void;
  onEditRole: (role: SystemRole) => void;
  onCloneRole: (role: SystemRole) => void;
  onDeleteRole: (roleId: string) => void;
  openMenuRoleId: string | null;
  onToggleMenu: (e: React.MouseEvent, roleId: string) => void;
}

export const RoleListView: React.FC<RoleListViewProps> = ({
  roles,
  users,
  searchQuery,
  onSearchChange,
  onCreateNewRole,
  onInspectRole,
  onEditRole,
  onCloneRole,
  onDeleteRole,
  openMenuRoleId,
  onToggleMenu,
}) => {
  // Lọc vai trò theo tìm kiếm
  const filteredRoles = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Đếm thành viên thực tế của từng vai trò
  const countMembers = (role: SystemRole) => {
    return users.filter((u) => {
      if (role.target_role === 'user') return u.role === 'user' || (u.role as string) === 'owner';
      if (role.target_role === 'caregiver') return u.role === 'caregiver' || (u.role as string) === 'member';
      return u.role === role.target_role;
    }).length;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header Hành động & Tìm kiếm */}
      <div className="glass-card p-4 sm:p-5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white/90 dark:bg-slate-900/90 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          {/* Input tìm kiếm vai trò */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm kiếm vai trò"
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-sans"
            />
          </div>

          {/* Nút Tạo Vai Trò */}
          <button
            onClick={onCreateNewRole}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 dark:bg-[#5865F2] dark:hover:bg-[#4752C4] shadow-md shadow-indigo-600/20 cursor-pointer transition-all shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Tạo Vai Trò</span>
          </button>
        </div>

        {/* Dòng ghi chú hỗ trợ */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <p>
            Các thành viên sử dụng màu của vai trò cao nhất trong danh sách. Kéo và sắp xếp thứ tự ưu tiên vai trò.{' '}
            <span className="text-sky-600 dark:text-sky-400 hover:underline cursor-pointer">
              Cần hỗ trợ về quyền?
            </span>
          </p>
          <span className="text-[11px] font-mono font-semibold text-slate-400 dark:text-slate-500">
            Tổng số: {roles.length} vai trò
          </span>
        </div>
      </div>

      {/* Bảng danh sách Vai trò - overflow-visible để không bị che menu 3 chấm */}
      <div className="glass-card border border-slate-200 dark:border-slate-800 rounded-2xl bg-white/90 dark:bg-slate-900/90 overflow-visible relative shadow-sm">
        {/* Header Bảng */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-800/40 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span>Vai trò — {filteredRoles.length}</span>
          </div>
          <div className="flex items-center gap-8 sm:gap-12 pr-4 sm:pr-6">
            <span>Thành viên</span>
            <span className="w-20 text-right">Thao tác</span>
          </div>
        </div>

        {/* Danh sách các dòng vai trò */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {filteredRoles.map((role, idx) => {
            const memberCount = countMembers(role);
            const isMenuOpen = openMenuRoleId === role.id;
            const isNearBottom = idx >= Math.max(0, filteredRoles.length - 2);

            return (
              <div
                key={role.id}
                onClick={() => onInspectRole(role)}
                className="flex items-center justify-between px-5 sm:px-6 py-3.5 hover:bg-slate-100/60 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group relative"
              >
                {/* Cột Tên vai trò & Icon khiên màu & Ổ khóa */}
                <div className="flex items-center gap-3 min-w-0 pr-4">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 shadow-xs"
                    style={{ backgroundColor: role.color }}
                  >
                    <Shield className="w-2.5 h-2.5 text-white stroke-[2.5]" />
                  </div>

                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    {role.name}
                  </span>

                  {role.is_system && (
                    <span
                      title="Vai trò cốt lõi hệ thống — Được bảo vệ chống xóa"
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0"
                    >
                      <Lock className="w-2.5 h-2.5" />
                      <span>Hệ thống</span>
                    </span>
                  )}
                </div>

                {/* Cột Số thành viên & Các nút thao tác */}
                <div className="flex items-center gap-8 sm:gap-12 shrink-0 pr-4 sm:pr-6">
                  {/* Số thành viên với icon người */}
                  <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 w-12 justify-end">
                    <span>{memberCount}</span>
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                  </div>

                  {/* Nút Xem chi tiết, Chỉnh sửa, và Menu 3 chấm */}
                  <div className="flex items-center gap-1 relative w-20 justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectRole(role);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors cursor-pointer"
                      title="Xem chi tiết vai trò"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditRole(role);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors cursor-pointer"
                      title="Chỉnh sửa vai trò"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => onToggleMenu(e, role.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors cursor-pointer"
                      title="Tùy chọn khác"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu 3 chấm */}
                    {isMenuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute right-0 ${
                          isNearBottom ? 'bottom-full mb-2 origin-bottom-right' : 'top-full mt-1.5 origin-top-right'
                        } w-48 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl py-1.5 z-50 animate-scale-in text-xs font-sans`}
                      >
                        <button
                          onClick={() => {
                            onInspectRole(role);
                          }}
                          className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span>Xem chi tiết</span>
                        </button>

                        <button
                          onClick={() => {
                            onEditRole(role);
                          }}
                          className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                          <span>Chỉnh sửa quyền</span>
                        </button>

                        <button
                          onClick={() => {
                            onCloneRole(role);
                          }}
                          className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5 text-sky-500" />
                          <span>Nhân bản vai trò</span>
                        </button>

                        {!role.is_system && (
                          <>
                            <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                            <button
                              onClick={() => {
                                onDeleteRole(role.id);
                              }}
                              className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer font-semibold"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>Xóa vai trò</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};


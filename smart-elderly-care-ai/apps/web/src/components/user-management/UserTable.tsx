import React from 'react';
import {
  Users,
  Phone,
  Home,
  ShieldCheck,
  KeyRound,
  Lock,
  Unlock,
  Trash2,
} from 'lucide-react';
import { User } from '../../types';
import { ROLE_CONFIG } from './constants';

interface UserTableProps {
  users: User[];
  onInspectPermissions: (user: User) => void;
  onEditUser: (user: User) => void;
  onToggleStatus: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

export const UserTable: React.FC<UserTableProps> = ({
  users,
  onInspectPermissions,
  onEditUser,
  onToggleStatus,
  onDeleteUser,
}) => {
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F5F6F8] dark:bg-[#202329] text-[11px] font-mono uppercase tracking-wider text-[#737780] dark:text-[#A1A7B1] border-b border-[#E7E9ED] dark:border-[#454A53] font-bold">
            <tr>
              <th className="py-3 px-4">Tài khoản & Họ tên</th>
              <th className="py-3 px-4">Số điện thoại</th>
              <th className="py-3 px-4 w-44 min-w-[160px]">Vai trò (Role)</th>
              <th className="py-3 px-4">Hộ gia đình phụ trách</th>
              <th className="py-3 px-4 text-center">Trạng thái</th>
              <th className="py-3 px-4 text-right">Thao tác & Phân quyền</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E9ED] dark:divide-[#454A53]">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[#737780]">
                  <Users className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-40" />
                  Không tìm thấy người dùng nào phù hợp với bộ lọc
                </td>
              </tr>
            ) : (
              users.map((userItem) => {
                const roleCfg = ROLE_CONFIG[userItem.role] || ROLE_CONFIG.user;
                const RoleIcon = roleCfg.icon;

                return (
                  <tr key={userItem.id} className="table-row-glass group">
                    {/* Name & Avatar */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#FF6B35] to-[#E95724] text-white font-bold text-xs flex items-center justify-center shrink-0 font-mono shadow-xs">
                          {userItem.full_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[#191B20] dark:text-[#F5F6F8] leading-tight">
                            {userItem.full_name}
                          </p>
                          <p className="text-[10px] font-mono text-[#737780] mt-0.5">
                            {userItem.id.startsWith('b') || userItem.id.startsWith('a')
                              ? `ID: ${userItem.id.slice(0, 8)}...`
                              : `ID: ${userItem.id}`}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5 text-[#191B20] dark:text-[#F5F6F8] font-mono text-xs">
                        <Phone className="w-3.5 h-3.5 text-[#737780] shrink-0" />
                        <span>{userItem.phone}</span>
                      </div>
                    </td>

                    {/* Role Badge (Đồng đều kích thước, 1 dòng, nếu thiếu chỗ thì hiện dấu ...) */}
                    <td className="py-3 px-4">
                      <div
                        title={roleCfg.label}
                        className={`h-7 inline-flex items-center space-x-1.5 px-2.5 rounded-lg text-[11px] font-mono font-semibold border whitespace-nowrap max-w-[160px] cursor-default shadow-2xs ${roleCfg.badgeStyle}`}
                      >
                        <RoleIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{roleCfg.label}</span>
                      </div>
                    </td>

                    {/* House */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5 text-xs text-[#737780] dark:text-[#A1A7B1]">
                        <Home className="w-3.5 h-3.5 text-[#737780] shrink-0" />
                        <span className="truncate max-w-[180px]">{userItem.assigned_house || 'Chưa phân bổ'}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onToggleStatus(userItem)}
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                          userItem.is_active ? 'badge-live' : 'badge-danger'
                        }`}
                      >
                        {userItem.is_active ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>HOẠT ĐỘNG</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            <span>ĐÃ KHÓA</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* Xem & kiểm tra quyền chi tiết */}
                        <button
                          onClick={() => onInspectPermissions(userItem)}
                          className="p-1.5 rounded-lg text-[#737780] hover:text-[#FF6B35] hover:bg-[#FFF0E8] dark:hover:bg-[#FF6B35]/15 transition-colors cursor-pointer"
                          title="Xem & kiểm tra Rule phân quyền của tài khoản này"
                        >
                          <ShieldCheck className="w-4 h-4 text-[#FF6B35]" />
                        </button>

                        {/* Chỉnh sửa tài khoản */}
                        <button
                          onClick={() => onEditUser(userItem)}
                          className="p-1.5 rounded-lg text-[#737780] hover:text-[#FF6B35] hover:bg-[#FFF0E8] dark:hover:bg-[#FF6B35]/15 transition-colors cursor-pointer"
                          title="Chỉnh sửa thông tin & Vai trò"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>

                        {/* Khóa / Mở khóa */}
                        <button
                          onClick={() => onToggleStatus(userItem)}
                          className="p-1.5 rounded-lg text-[#737780] hover:text-[#E9A23B] hover:bg-amber-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          title={userItem.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                        >
                          {userItem.is_active ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <Unlock className="w-4 h-4 text-[#FF6B35]" />
                          )}
                        </button>

                        {/* Xóa tài khoản */}
                        {userItem.role !== 'admin' && (
                          <button
                            onClick={() => onDeleteUser(userItem)}
                            className="p-1.5 rounded-lg text-[#737780] hover:text-[#E5484D] hover:bg-rose-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            title="Xóa tài khoản"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

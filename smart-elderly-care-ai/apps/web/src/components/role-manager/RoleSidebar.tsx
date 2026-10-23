import React from 'react';
import { ArrowLeft, Plus, Shield, Lock, Trash2 } from 'lucide-react';
import { SystemRole } from './types';

interface RoleSidebarProps {
  roles: SystemRole[];
  selectedRoleId: string;
  onSelectRole: (role: SystemRole) => void;
  onBackToList: () => void;
  onCreateNewRole: () => void;
  onDeleteRole: (roleId: string) => void;
}

export const RoleSidebar: React.FC<RoleSidebarProps> = ({
  roles,
  selectedRoleId,
  onSelectRole,
  onBackToList,
  onCreateNewRole,
  onDeleteRole,
}) => {
  return (
    <div className="md:col-span-4 lg:col-span-3 border-r border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/70 p-3 sm:p-4 flex flex-col justify-between">
      <div className="space-y-4">
        {/* Header Cột Trái: Nút Trở lại & Nút + */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
          <button
            onClick={onBackToList}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Trở lại</span>
          </button>

          <button
            onClick={onCreateNewRole}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-sky-500 dark:hover:bg-sky-600 transition-colors cursor-pointer"
            title="Tạo vai trò mới"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Danh sách vai trò dọc */}
        <div className="space-y-1 max-h-[580px] overflow-y-auto pr-1 custom-scrollbar">
          {roles.map((role) => {
            const isSelected = role.id === selectedRoleId;

            return (
              <button
                key={role.id}
                onClick={() => onSelectRole(role)}
                className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-200/90 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: role.color }}
                  />
                  <span className="truncate">{role.name}</span>
                </div>

                {role.is_system && (
                  <span title="Vai trò hệ thống">
                    <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Cột Trái: Nút xóa vai trò nếu không phải system role */}
      {(() => {
        const selected = roles.find((r) => r.id === selectedRoleId);
        if (!selected || selected.is_system) return null;
        return (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => onDeleteRole(selected.id)}
              className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa vai trò</span>
            </button>
          </div>
        );
      })()}
    </div>
  );
};


import React from 'react';
import { Search, Info, Sliders } from 'lucide-react';
import { SystemRole, PermissionCategory } from './types';
import { SECA_PERMISSION_CATEGORIES } from './constants';

interface RolePermissionsTabProps {
  draftRole: SystemRole;
  isEditMode: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onTogglePermission: (permId: string) => void;
  onToggleCategoryPermissions: (cat: PermissionCategory, enableAll: boolean) => void;
}

export const RolePermissionsTab: React.FC<RolePermissionsTabProps> = ({
  draftRole,
  isEditMode,
  searchQuery,
  onSearchChange,
  onTogglePermission,
  onToggleCategoryPermissions,
}) => {
  // Lọc các quyền hạn theo search query
  const filteredCategories = SECA_PERMISSION_CATEGORIES.map((cat) => {
    const matchedPerms = cat.permissions.filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { ...cat, permissions: matchedPerms };
  }).filter((cat) => cat.permissions.length > 0);

  return (
    <div className="space-y-6">
      {/* Banner thông báo trạng thái Chỉ đọc nếu đang ở chế độ xem */}
      {!isEditMode && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
          <Info className="w-4 h-4 text-sky-500 shrink-0" />
          <span>
            Bạn đang ở <b>Chế độ xem (Chỉ đọc)</b>. Để kích hoạt hoặc thu hồi các quyền bên dưới, vui lòng bấm nút <b>"Chỉnh sửa vai trò"</b> ở góc trên bên phải.
          </span>
        </div>
      )}

      {/* Input tìm kiếm quyền hạn */}
      <div className="relative max-w-md">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm kiếm quyền hạn"
          className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 font-sans"
        />
      </div>

      {/* Danh sách các nhóm quyền hạn */}
      <div className="space-y-6">
        {filteredCategories.map((cat) => {
          const CategoryIcon = cat.icon || Sliders;
          const catPermIds = cat.permissions.map((p) => p.id);
          const activeCount = catPermIds.filter((pid) =>
            draftRole.permissions.includes(pid)
          ).length;
          const isAllActive = activeCount === catPermIds.length && catPermIds.length > 0;

          return (
            <div
              key={cat.id}
              className="space-y-3 p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800"
            >
              {/* Tiêu đề nhóm quyền */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <CategoryIcon className={`w-4 h-4 ${cat.color}`} />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
                    {cat.title}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {activeCount}/{catPermIds.length}
                  </span>
                </div>

                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => onToggleCategoryPermissions(cat, !isAllActive)}
                    className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    {isAllActive ? 'Tắt tất cả' : 'Bật tất cả'}
                  </button>
                )}
              </div>

              {/* Các quyền trong nhóm */}
              <div className="space-y-3 pt-1">
                {cat.permissions.map((perm) => {
                  const isChecked = draftRole.permissions.includes(perm.id);

                  return (
                    <div
                      key={perm.id}
                      className="flex items-start justify-between gap-4 py-2 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-xl px-2 transition-colors"
                    >
                      <div className="space-y-0.5 flex-1">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          {perm.name}
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                          {perm.description}
                        </p>
                      </div>

                      {/* Smooth Toggle Switch */}
                      <button
                        type="button"
                        role="switch"
                        disabled={!isEditMode}
                        aria-checked={isChecked}
                        onClick={() => {
                          if (isEditMode) onTogglePermission(perm.id);
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isEditMode
                            ? 'cursor-pointer focus:ring-2 focus:ring-sky-500/30'
                            : 'cursor-not-allowed opacity-60'
                        } ${
                          isChecked
                            ? 'bg-sky-500 dark:bg-sky-500'
                            : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                        title={
                          isEditMode
                            ? (isChecked ? 'Bấm để tắt' : 'Bấm để bật')
                            : 'Chế độ xem - Hãy bấm nút "Chỉnh sửa vai trò" để thay đổi quyền'
                        }
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            isChecked ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


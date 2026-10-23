import React from 'react';
import { Palette, Check, Info } from 'lucide-react';
import { SystemRole } from './types';
import { ROLE_COLOR_SWATCHES } from './constants';

interface RoleDisplayTabProps {
  draftRole: SystemRole;
  isEditMode: boolean;
  onUpdateDraft: (updates: Partial<SystemRole>) => void;
}

export const RoleDisplayTab: React.FC<RoleDisplayTabProps> = ({
  draftRole,
  isEditMode,
  onUpdateDraft,
}) => {
  return (
    <div className="space-y-5 max-w-xl animate-fade-in">
      {/* Banner thông báo trạng thái Chỉ đọc nếu đang ở chế độ xem */}
      {!isEditMode && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
          <Info className="w-4 h-4 text-sky-500 shrink-0" />
          <span>
            Bạn đang ở <b>Chế độ xem (Chỉ đọc)</b>. Để sửa tên, màu sắc hoặc quyền hạn, vui lòng bấm nút <b>"Chỉnh sửa vai trò"</b> ở phía trên.
          </span>
        </div>
      )}

      {/* Tên vai trò */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Tên vai trò
        </label>
        <input
          type="text"
          value={draftRole.name}
          disabled={!isEditMode || draftRole.is_system}
          onChange={(e) => onUpdateDraft({ name: e.target.value })}
          className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed font-sans"
        />
        {draftRole.is_system && (
          <span className="text-[11px] text-slate-400">
            Vai trò mặc định hệ thống không thể đổi tên.
          </span>
        )}
      </div>

      {/* Bảng màu sắc vai trò */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5" />
          <span>Màu sắc vai trò</span>
        </label>
        <div className="flex flex-wrap gap-2.5 items-center">
          {ROLE_COLOR_SWATCHES.map((swatch) => {
            const isColorActive = draftRole.color.toLowerCase() === swatch.hex.toLowerCase();
            return (
              <button
                key={swatch.hex}
                type="button"
                disabled={!isEditMode}
                onClick={() => {
                  if (isEditMode) {
                    onUpdateDraft({ color: swatch.hex });
                  }
                }}
                style={{ backgroundColor: swatch.hex }}
                className={`w-7 h-7 rounded-full transition-transform relative shadow-xs flex items-center justify-center ${
                  isEditMode
                    ? 'cursor-pointer hover:scale-105'
                    : 'cursor-not-allowed opacity-60'
                } ${
                  isColorActive
                    ? 'scale-115 ring-2 ring-white ring-offset-2 ring-offset-slate-900 opacity-100'
                    : ''
                }`}
                title={swatch.name}
              >
                {isColorActive && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
              </button>
            );
          })}

          {/* Custom Hex Picker Input */}
          <div
            className={`flex items-center gap-1.5 ml-2 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 bg-slate-100 dark:bg-slate-800 ${
              !isEditMode ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            <span className="text-xs font-mono text-slate-400">#</span>
            <input
              type="text"
              disabled={!isEditMode}
              value={draftRole.color.replace('#', '')}
              onChange={(e) => onUpdateDraft({ color: `#${e.target.value}` })}
              className="w-16 text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 outline-none uppercase disabled:cursor-not-allowed"
              maxLength={6}
            />
          </div>
        </div>
      </div>

      {/* Mô tả vai trò */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Mô tả vai trò
        </label>
        <textarea
          rows={3}
          disabled={!isEditMode}
          value={draftRole.description}
          onChange={(e) => onUpdateDraft({ description: e.target.value })}
          className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-sans disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      {/* Hoist Toggle */}
      <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Hiển thị riêng biệt trong danh sách thành viên
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Nhóm các thành viên có vai trò này ở một đề mục riêng biệt để dễ nhận biết.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          disabled={!isEditMode}
          aria-checked={draftRole.hoist}
          onClick={() => {
            if (isEditMode) {
              onUpdateDraft({ hoist: !draftRole.hoist });
            }
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
            isEditMode ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
          } ${
            draftRole.hoist ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
              draftRole.hoist ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
};


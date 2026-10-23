import React from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { PermissionRule, UserRole } from '../../types';
import { PERMISSION_GROUPS } from './constants';

interface CreateEditRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingRule: PermissionRule | null;
  ruleName: string;
  setRuleName: (v: string) => void;
  ruleDescription: string;
  setRuleDescription: (v: string) => void;
  ruleTargetRole: UserRole | 'all';
  setRuleTargetRole: (v: UserRole | 'all') => void;
  ruleModule: string;
  setRuleModule: (v: string) => void;
  rulePermissions: string[];
  setRulePermissions: (v: string[]) => void;
  ruleIsActive: boolean;
  setRuleIsActive: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const CreateEditRuleModal: React.FC<CreateEditRuleModalProps> = ({
  isOpen,
  onClose,
  editingRule,
  ruleName,
  setRuleName,
  ruleDescription,
  setRuleDescription,
  ruleTargetRole,
  setRuleTargetRole,
  ruleModule,
  setRuleModule,
  rulePermissions,
  setRulePermissions,
  ruleIsActive,
  setRuleIsActive,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const handleTogglePermission = (permId: string) => {
    if (rulePermissions.includes(permId)) {
      setRulePermissions(rulePermissions.filter((p) => p !== permId));
    } else {
      setRulePermissions([...rulePermissions, permId]);
    }
  };

  const handleSelectGroupAll = (groupItems: { id: string }[]) => {
    const groupItemIds = groupItems.map((i) => i.id);
    const allSelected = groupItemIds.every((id) => rulePermissions.includes(id));
    if (allSelected) {
      setRulePermissions(rulePermissions.filter((p) => !groupItemIds.includes(p)));
    } else {
      const merged = Array.from(new Set([...rulePermissions, ...groupItemIds]));
      setRulePermissions(merged);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-hidden border border-[#C8AD8A] shadow-2xl animate-slide-up flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#C8AD8A]/50 bg-[#FFF8EE] dark:bg-[#1A3830] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF8EE] dark:bg-[#142823] text-[#D96C3B] border border-[#C8AD8A] flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-slate-900 dark:text-white text-sm">
                {editingRule ? 'Chỉnh sửa quy tắc phân quyền (Rule)' : 'Tạo mới quy tắc phân quyền (Rule)'}
              </h3>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Cấu hình quyền truy cập chi tiết cho Chủ nhà, Thành viên, Bác sĩ & IoT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Scrollable */}
        <form onSubmit={onSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Tên Rule */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
              Tên quy tắc phân quyền (Rule Name) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="Ví dụ: Quyền kiểm soát Camera AI & Chế độ riêng tư"
              className="input-glass"
            />
          </div>

          {/* Vai trò áp dụng & Phân hệ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Áp dụng cho vai trò:
              </label>
              <select
                value={ruleTargetRole}
                onChange={(e) => setRuleTargetRole(e.target.value as any)}
                className="input-glass text-xs"
              >
                <option value="user">Chủ nhà (Owner)</option>
                <option value="caregiver">Thành viên (Member)</option>
                <option value="doctor">Bác sĩ chuyên khoa</option>
                <option value="admin">Quản trị viên (Admin)</option>
                <option value="elderly">Người cao tuổi</option>
                <option value="all">Tất cả vai trò</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Phân hệ chính:
              </label>
              <select
                value={ruleModule}
                onChange={(e) => setRuleModule(e.target.value)}
                className="input-glass text-xs"
              >
                <option value="all">Toàn hệ thống (All Modules)</option>
                <option value="camera">Camera AI & Hình ảnh</option>
                <option value="vitals">Sinh hiệu & Sức khỏe</option>
                <option value="emergency">Cảnh báo & SOS</option>
                <option value="devices">Thiết bị IoT & Căn nhà</option>
                <option value="members">Gia đình & Thành viên</option>
                <option value="medical">Y tế & Đơn thuốc</option>
              </select>
            </div>
          </div>

          {/* Mô tả */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
              Mô tả mục đích của Rule:
            </label>
            <textarea
              rows={2}
              value={ruleDescription}
              onChange={(e) => setRuleDescription(e.target.value)}
              placeholder="Ghi chú rõ quyền hạn được cấp và phạm vi ảnh hưởng..."
              className="input-glass text-xs"
            />
          </div>

          {/* Danh sách các quyền hạn chi tiết theo nhóm */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Danh mục quyền được kích hoạt ({rulePermissions.length} quyền đã chọn):
              </label>
              <span className="text-[11px] text-slate-500">
                Tích chọn các quyền mong muốn cấp cho Rule này
              </span>
            </div>

            <div className="space-y-3">
              {PERMISSION_GROUPS.map((group) => {
                const GroupIcon = group.icon;
                const groupSelectedCount = group.items.filter((i) =>
                  rulePermissions.includes(i.id)
                ).length;

                return (
                  <div
                    key={group.moduleKey}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <GroupIcon className={`w-4 h-4 ${group.color}`} />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {group.title}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                          {groupSelectedCount}/{group.items.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectGroupAll(group.items)}
                        className="text-[11px] text-[#D96C3B] hover:underline font-semibold cursor-pointer"
                      >
                        {groupSelectedCount === group.items.length ? 'Bỏ chọn' : 'Chọn tất cả'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.items.map((perm) => {
                        const isChecked = rulePermissions.includes(perm.id);
                        return (
                          <label
                            key={perm.id}
                            className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-[#FFF8EE] dark:bg-[#1A3830] border-[#D96C3B]/60 text-slate-900 dark:text-white font-medium'
                                : 'border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePermission(perm.id)}
                              className="mt-0.5 rounded text-[#D96C3B] focus:ring-[#D96C3B]"
                            />
                            <span className="leading-tight">{perm.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trạng thái Kích hoạt */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF5EE] dark:bg-[#142823] border border-[#C8AD8A]/50">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Trạng thái kích hoạt Rule:
              </span>
              <span className="text-[11px] text-slate-500">
                Khi kích hoạt, Rule sẽ có hiệu lực ngay lập tức cho các tài khoản tương ứng
              </span>
            </div>
            <button
              type="button"
              onClick={() => setRuleIsActive(!ruleIsActive)}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                ruleIsActive
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {ruleIsActive ? 'Đang kích hoạt' : 'Tạm dừng'}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#C8AD8A]/30 flex items-center justify-end space-x-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost text-xs py-2 px-4 cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button type="submit" className="btn-primary text-xs py-2 px-5 cursor-pointer">
              {editingRule ? 'Lưu thay đổi Rule' : 'Xác nhận tạo Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


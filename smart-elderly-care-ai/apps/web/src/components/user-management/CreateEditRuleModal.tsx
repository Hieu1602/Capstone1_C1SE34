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
      <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-hidden border border-[#E7E9ED] dark:border-[#454A53] shadow-2xl animate-slide-up flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#E7E9ED] dark:border-[#454A53] bg-[#F5F6F8] dark:bg-[#202329] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF0E8] dark:bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/20 flex items-center justify-center shadow-2xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-[#191B20] dark:text-[#F5F6F8] text-sm">
                {editingRule ? 'Chỉnh sửa quy tắc phân quyền (Rule)' : 'Tạo mới quy tắc phân quyền (Rule)'}
              </h3>
              <p className="text-[11px] font-mono text-[#737780] dark:text-[#A1A7B1]">
                Cấu hình quyền truy cập chi tiết cho Chủ nhà, Thành viên, Bác sĩ & IoT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#737780] hover:text-[#191B20] dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Scrollable */}
        <form onSubmit={onSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Tên Rule */}
          <div>
            <label className="block text-xs font-bold text-[#191B20] dark:text-[#F5F6F8] mb-1">
              Tên quy tắc phân quyền (Rule Name) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="Ví dụ: Quyền xem Camera & Cảnh báo cho Thành viên phụ"
              className="input-glass"
            />
          </div>

          {/* Mô tả Rule */}
          <div>
            <label className="block text-xs font-bold text-[#191B20] dark:text-[#F5F6F8] mb-1">
              Mô tả mục đích
            </label>
            <textarea
              rows={2}
              value={ruleDescription}
              onChange={(e) => setRuleDescription(e.target.value)}
              placeholder="Mô tả phạm vi áp dụng, bảo mật và lưu ý khi cấp quyền này..."
              className="input-glass"
            />
          </div>

          {/* Cấu hình Target Role & Module */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#191B20] dark:text-[#F5F6F8] mb-1">
                Áp dụng cho đối tượng vai trò
              </label>
              <select
                value={ruleTargetRole}
                onChange={(e) => setRuleTargetRole(e.target.value as any)}
                className="input-glass font-medium"
              >
                <option value="all">Tất cả vai trò</option>
                <option value="admin">Quản trị viên (Admin)</option>
                <option value="doctor">Bác sĩ chuyên khoa (Doctor)</option>
                <option value="owner">Chủ nhà (Owner)</option>
                <option value="member">Thành viên (Member)</option>
                <option value="elderly">Người cao tuổi (Elderly)</option>
                <option value="user">Người dùng cơ bản (User)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#191B20] dark:text-[#F5F6F8] mb-1">
                Phân hệ nghiệp vụ chính
              </label>
              <select
                value={ruleModule}
                onChange={(e) => setRuleModule(e.target.value)}
                className="input-glass font-medium"
              >
                <option value="all">Tất cả phân hệ (Global Policy)</option>
                <option value="camera">Camera AI & Phát hiện té ngã</option>
                <option value="vitals">Sinh hiệu y tế & ECG/SpO2</option>
                <option value="devices">Thiết bị IoT & Cảm biến</option>
                <option value="emergency">Báo động khẩn cấp SOS</option>
                <option value="house">Cài đặt căn nhà & Thành viên</option>
              </select>
            </div>
          </div>

          {/* Danh sách Ma trận quyền chi tiết */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#191B20] dark:text-[#F5F6F8]">
                Danh sách quyền hạn cho phép ({rulePermissions.length} quyền được chọn)
              </label>
              <span className="text-[10px] text-[#737780] font-mono">
                Click nhóm để chọn toàn bộ
              </span>
            </div>

            <div className="space-y-3 border border-[#E7E9ED] dark:border-[#454A53] rounded-xl p-3 bg-[#F5F6F8] dark:bg-[#17191E]">
              {PERMISSION_GROUPS.map((group) => {
                const groupItemIds = group.items.map((i) => i.id);
                const isAllSelected = groupItemIds.every((id) => rulePermissions.includes(id));
                const isSomeSelected =
                  groupItemIds.some((id) => rulePermissions.includes(id)) && !isAllSelected;

                return (
                  <div
                    key={group.groupName}
                    className="p-2.5 rounded-xl bg-white dark:bg-[#202329] border border-[#E7E9ED] dark:border-[#454A53]"
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E7E9ED] dark:border-[#454A53]">
                      <span className="font-bold text-xs text-[#191B20] dark:text-[#F5F6F8]">
                        {group.groupName}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectGroupAll(group.items)}
                        className="text-[10px] font-bold font-mono text-[#FF6B35] hover:underline cursor-pointer"
                      >
                        {isAllSelected
                          ? 'Bỏ chọn nhóm'
                          : isSomeSelected
                          ? 'Chọn tất cả nhóm'
                          : 'Chọn nhóm'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.items.map((perm) => {
                        const checked = rulePermissions.includes(perm.id);
                        return (
                          <label
                            key={perm.id}
                            className={`flex items-start space-x-2 p-2 rounded-lg border text-left cursor-pointer transition-all ${
                              checked
                                ? 'border-[#FF6B35] bg-[#FFF0E8] dark:bg-[#FF6B35]/15 text-[#FF6B35] shadow-2xs'
                                : 'border-[#E7E9ED] dark:border-[#454A53] hover:bg-slate-50 dark:hover:bg-white/5 text-[#737780]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleTogglePermission(perm.id)}
                              className="mt-0.5 rounded text-[#FF6B35] focus:ring-[#FF6B35]"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold leading-tight">{perm.name}</p>
                              <p className="text-[10px] font-mono opacity-70 mt-0.5">{perm.id}</p>
                            </div>
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
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#F5F6F8] dark:bg-[#202329] border border-[#E7E9ED] dark:border-[#454A53]">
            <div>
              <p className="text-xs font-bold text-[#191B20] dark:text-[#F5F6F8]">Kích hoạt quy tắc này ngay lập tức</p>
              <p className="text-[11px] text-[#737780]">
                Khi tắt, quy tắc này sẽ tạm thời không có hiệu lực đối với người dùng
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={ruleIsActive}
                onChange={(e) => setRuleIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-[#202329] dark:border dark:border-[#454A53] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF6B35]"></div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-[#E7E9ED] dark:border-[#454A53]">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              {editingRule ? 'Lưu thay đổi Rule' : 'Tạo mới Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

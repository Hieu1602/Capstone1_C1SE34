import React from 'react';
import {
  Bell,
  X,
  Send,
  Calendar,
  FileEdit,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import {
  SystemNotification,
  NotificationType,
  TargetAudience,
} from '../../types';

interface CreateEditNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingNotification: SystemNotification | null;
  formTitle: string;
  setFormTitle: (v: string) => void;
  formBody: string;
  setFormBody: (v: string) => void;
  formType: NotificationType;
  setFormType: (v: NotificationType) => void;
  formAudience: TargetAudience;
  setFormAudience: (v: TargetAudience) => void;
  formActionType: 'draft' | 'publish' | 'schedule';
  setFormActionType: (v: 'draft' | 'publish' | 'schedule') => void;
  formScheduledAt: string;
  setFormScheduledAt: (v: string) => void;
  formExpiryType: 'never' | 'preset_1h' | 'preset_24h' | 'preset_3d' | 'preset_7d' | 'custom';
  onSelectExpiryPreset: (type: 'never' | 'preset_1h' | 'preset_24h' | 'preset_3d' | 'preset_7d' | 'custom') => void;
  formExpiresAt: string;
  setFormExpiresAt: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const CreateEditNotificationModal: React.FC<CreateEditNotificationModalProps> = ({
  isOpen,
  onClose,
  editingNotification,
  formTitle,
  setFormTitle,
  formBody,
  setFormBody,
  formType,
  setFormType,
  formAudience,
  setFormAudience,
  formActionType,
  setFormActionType,
  formScheduledAt,
  setFormScheduledAt,
  formExpiryType,
  onSelectExpiryPreset,
  formExpiresAt,
  setFormExpiresAt,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl glass-card border border-[#C8AD8A] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#C8AD8A]/50 bg-[#FFF8EE] dark:bg-[#1A3830]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#D96C3B]" />
            <h3 className="text-sm font-bold font-heading text-slate-900 dark:text-white">
              {editingNotification ? 'Chỉnh sửa thông báo' : 'Soạn thông báo toàn hệ thống mới'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-[#D96C3B]/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {/* Tiêu đề */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
              Tiêu đề thông báo <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Lịch bảo trì máy chủ định kỳ ngày 18/10"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="input-glass"
            />
          </div>

          {/* Phân loại & Đối tượng */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Phân loại thông báo
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as NotificationType)}
                className="input-glass"
              >
                <option value="info">Thông tin chung</option>
                <option value="system_maintenance">Bảo trì hệ thống</option>
                <option value="emergency">Khẩn cấp / Cảnh báo</option>
                <option value="health_tip">Lời khuyên sức khỏe</option>
                <option value="feature_update">Cập nhật tính năng</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Đối tượng nhận
              </label>
              <select
                value={formAudience}
                onChange={(e) => setFormAudience(e.target.value as TargetAudience)}
                className="input-glass"
              >
                <option value="all">Tất cả người dùng</option>
                <option value="caregivers">Gia đình & Người chăm sóc</option>
                <option value="doctors">Bác sĩ chuyên khoa</option>
                <option value="elderly">Người cao tuổi</option>
              </select>
            </div>
          </div>

          {/* Nội dung */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
              Nội dung chi tiết <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Nhập nội dung thông báo gửi đến điện thoại người dùng..."
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              className="input-glass"
            />
          </div>

          {/* Lựa chọn hình thức phát hành */}
          {!editingNotification && (
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                Hình thức phát hành
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormActionType('publish')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    formActionType === 'publish'
                      ? 'border-[#D96C3B] bg-[#FFF8EE] dark:bg-[#1A3830] text-[#D96C3B] font-bold shadow-sm'
                      : 'border-[#C8AD8A]/40 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Send className="w-3.5 h-3.5 mb-1 text-[#D96C3B]" />
                  <div className="text-xs">Phát hành ngay</div>
                  <div className="text-[10px] opacity-75">Gửi Push FCM</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormActionType('schedule')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    formActionType === 'schedule'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 font-bold shadow-sm'
                      : 'border-[#C8AD8A]/40 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 mb-1 text-amber-500" />
                  <div className="text-xs">Lên lịch phát</div>
                  <div className="text-[10px] opacity-75">Hẹn giờ tự động</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormActionType('draft')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    formActionType === 'draft'
                      ? 'border-slate-500 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold shadow-sm'
                      : 'border-[#C8AD8A]/40 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <FileEdit className="w-3.5 h-3.5 mb-1 text-slate-500" />
                  <div className="text-xs">Lưu bản nháp</div>
                  <div className="text-[10px] opacity-75">Soạn thảo trước</div>
                </button>
              </div>
            </div>
          )}

          {/* Bộ chọn thời gian hẹn giờ nếu chọn schedule */}
          {formActionType === 'schedule' && (
            <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
              <label className="block text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                Chọn thời điểm phát hành tự động <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={formScheduledAt}
                onChange={(e) => setFormScheduledAt(e.target.value)}
                className="input-glass font-mono"
              />
              <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                Hệ thống sẽ tự động kích hoạt thông báo và gửi đến điện thoại người dùng đúng thời điểm này.
              </p>
            </div>
          )}

          {/* Giới hạn thời gian thông báo tồn tại (Lifespan / Expiration) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[#C8AD8A]/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#D96C3B]" />
                <span>Giới hạn thời gian thông báo tồn tại</span>
              </label>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                (Tự động đóng khi hết hạn)
              </span>
            </div>

            {/* Các nút chọn nhanh thời hạn */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {[
                { id: 'never', label: 'Vĩnh viễn', desc: 'Không hết hạn' },
                { id: 'preset_1h', label: '1 giờ', desc: '+1 tiếng' },
                { id: 'preset_24h', label: '24 giờ', desc: '+1 ngày' },
                { id: 'preset_3d', label: '3 ngày', desc: '+3 ngày' },
                { id: 'preset_7d', label: '7 ngày', desc: '+1 tuần' },
                { id: 'custom', label: 'Tùy chọn', desc: 'Chọn ngày giờ' },
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectExpiryPreset(preset.id as any)}
                  className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                    formExpiryType === preset.id
                      ? 'border-[#D96C3B] bg-[#FFF8EE] dark:bg-[#1A3830] text-[#D96C3B] font-bold shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-[#C8AD8A]/60'
                  }`}
                >
                  <div className="text-xs">{preset.label}</div>
                  <div className="text-[9px] opacity-75">{preset.desc}</div>
                </button>
              ))}
            </div>

            {/* Ô chọn ngày giờ cụ thể */}
            {formExpiryType === 'custom' && (
              <div className="pt-1.5">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mốc thời gian hết hạn cụ thể:
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                  className="input-glass font-mono text-xs"
                />
              </div>
            )}

            {formExpiryType !== 'never' && formExpiresAt && (
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>
                  Thông báo sẽ tự động ẩn lúc: {new Date(formExpiresAt).toLocaleString('vi-VN')}
                </span>
              </p>
            )}
            {formExpiryType === 'never' && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span>Thông báo sẽ tồn tại liên tục cho đến khi Admin chủ động thu hồi.</span>
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#C8AD8A]/30">
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
              {editingNotification ? 'Cập nhật thay đổi' : 'Xác nhận tạo thông báo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


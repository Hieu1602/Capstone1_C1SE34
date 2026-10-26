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
  secondaryApprover?: string;
  setSecondaryApprover?: (v: string) => void;
  onTestSend?: () => void;
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
  secondaryApprover = '',
  setSecondaryApprover,
  onTestSend,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl glass-card border border-[#E7E9ED] dark:border-[#454A53] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E9ED] dark:border-[#454A53] bg-[#F5F6F8] dark:bg-[#202329] shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#FF6B35]" />
            <h3 className="text-sm font-bold font-heading text-[#191B20] dark:text-[#F5F6F8]">
              {editingNotification ? 'Chỉnh sửa thông báo' : 'Soạn thông báo toàn hệ thống mới'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#737780] hover:text-[#191B20] dark:hover:text-white hover:bg-[#FFF0E8] dark:hover:bg-[#FF6B35]/15 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Tiêu đề */}
          <div>
            <label className="block text-xs font-bold text-[#191B20] dark:text-[#F5F6F8] mb-1">
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
              <label className="block text-xs font-bold text-[#191B20] dark:text-[#F5F6F8] mb-1">
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
              <label className="block text-xs font-bold text-[#191B20] dark:text-[#F5F6F8] mb-1">
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

          {/* Mức độ Khẩn cấp: Bắt buộc 2 người duyệt & Cảnh báo kênh SOS */}
          {formType === 'emergency' && (
            <div className="p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold">
                <span>⚠️ MỨC ĐỘ KHẨN CẤP: YÊU CẦU DUYỆT 2 NGƯỜI (FOUR-EYES)</span>
              </div>
              <p className="text-[11px] text-rose-700 dark:text-rose-400 leading-relaxed">
                Thông báo khẩn cấp hệ thống <b>tuyệt đối không được sử dụng để phát còi hú thay thế kênh SOS té ngã cục bộ</b> nhằm tránh gây trơ phản xạ báo động của người nhà và bác sĩ.
              </p>
              {setSecondaryApprover && (
                <div>
                  <label className="block text-[11px] font-bold text-rose-800 dark:text-rose-300 mb-1">
                    Người duyệt thứ hai (Bác sĩ trực / Trưởng ca) <span className="text-rose-600">*</span>:
                  </label>
                  <input
                    type="text"
                    required
                    value={secondaryApprover}
                    onChange={(e) => setSecondaryApprover(e.target.value)}
                    placeholder="Ví dụ: BS. Trần Văn Minh (Khoa Cấp cứu)"
                    className="input-glass border-rose-300 dark:border-rose-800"
                  />
                </div>
              )}
            </div>
          )}

          {/* Quy tắc giờ yên tĩnh cho Người cao tuổi */}
          {(formAudience === 'elderly' || formAudience === 'all') && (
            <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <span>🌙</span>
              <span>
                <b>Khung giờ yên tĩnh (22:00 - 06:00):</b> Thông báo gửi vào khung giờ này sẽ tự động tắt âm thanh qua Loa thông minh của người cao tuổi.
              </span>
            </div>
          )}

          {/* Nội dung */}
          <div>
            <label className="block text-xs font-bold text-[#191B20] dark:text-[#F5F6F8] mb-1">
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
              <label className="block text-xs font-bold text-[#191B20] dark:text-[#F5F6F8] mb-2">
                Hình thức phát hành
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormActionType('publish')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    formActionType === 'publish'
                      ? 'border-[#FF6B35] bg-[#FFF0E8] dark:bg-[#FF6B35]/15 text-[#FF6B35] font-bold shadow-2xs'
                      : 'border-[#E7E9ED] dark:border-[#454A53] text-[#737780]'
                  }`}
                >
                  <Send className="w-3.5 h-3.5 mb-1 text-[#FF6B35]" />
                  <div className="text-xs">Phát hành ngay</div>
                  <div className="text-[10px] opacity-75">Gửi Push FCM</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormActionType('schedule')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    formActionType === 'schedule'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 font-bold shadow-2xs'
                      : 'border-[#E7E9ED] dark:border-[#454A53] text-[#737780]'
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
                      ? 'border-slate-500 bg-slate-100 dark:bg-[#202329] text-[#191B20] dark:text-[#F5F6F8] font-bold shadow-2xs'
                      : 'border-[#E7E9ED] dark:border-[#454A53] text-[#737780]'
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
          <div className="p-3.5 rounded-xl bg-[#F5F6F8] dark:bg-[#17191E] border border-[#E7E9ED] dark:border-[#454A53] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#191B20] dark:text-[#F5F6F8] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#FF6B35]" />
                <span>Giới hạn thời gian thông báo tồn tại</span>
              </label>
              <span className="text-[10px] text-[#737780]">
                (Tự động đóng khi hết hạn)
              </span>
            </div>

            {/* Các nút chọn nhanh thời hạn */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {[
                { id: 'never', label: 'Tối đa 30 ngày', desc: 'Trần an toàn' },
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
                      ? 'border-[#FF6B35] bg-[#FFF0E8] dark:bg-[#FF6B35]/15 text-[#FF6B35] font-bold shadow-2xs'
                      : 'border-slate-200 dark:border-[#454A53] text-[#737780] hover:border-[#FF6B35]/40'
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
                <label className="block text-[11px] font-semibold text-[#191B20] dark:text-[#F5F6F8] mb-1">
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
              <p className="text-[10px] text-[#737780] flex items-center gap-1">
                <span>Thời hạn tối đa 30 ngày để chống quá tải thông tin, cần gia hạn định kỳ nếu muốn hiển thị tiếp.</span>
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="sticky bottom-0 bg-white/95 dark:bg-[#1A1D23]/95 backdrop-blur-sm pt-3 pb-1 border-t border-[#E7E9ED] dark:border-[#454A53] flex items-center justify-end gap-2 -mx-5 px-5 mt-4 z-10">
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

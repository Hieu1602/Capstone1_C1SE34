import React from 'react';
import { Search, Filter } from 'lucide-react';

interface NotificationFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  audienceFilter: string;
  onAudienceFilterChange: (value: string) => void;
}

export const NotificationFilterBar: React.FC<NotificationFilterBarProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  audienceFilter,
  onAudienceFilterChange,
}) => {
  return (
    <div className="glass-card p-4 relative z-10 flex flex-col md:flex-row gap-3">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm theo tiêu đề hoặc nội dung thông báo..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs bg-[#FAF5EE] dark:bg-[#142823] border border-[#C8AD8A] dark:border-[#23483E] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#D96C3B] focus:ring-1 focus:ring-[#D96C3B]/30 transition-all shadow-sm"
        />
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-slate-500" />
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs bg-[#FAF5EE] dark:bg-[#142823] border border-[#C8AD8A] dark:border-[#23483E] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#D96C3B] transition-all shadow-sm"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="published">Đã phát hành</option>
          <option value="scheduled">Đã lên lịch</option>
          <option value="draft">Bản nháp</option>
          <option value="revoked">Đã thu hồi</option>
        </select>
      </div>

      {/* Type Filter */}
      <div>
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-xs bg-[#FAF5EE] dark:bg-[#142823] border border-[#C8AD8A] dark:border-[#23483E] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#D96C3B] transition-all shadow-sm"
        >
          <option value="all">Tất cả phân loại</option>
          <option value="info">Thông tin chung</option>
          <option value="system_maintenance">Bảo trì hệ thống</option>
          <option value="emergency">Khẩn cấp / Cảnh báo</option>
          <option value="health_tip">Lời khuyên sức khỏe</option>
          <option value="feature_update">Cập nhật tính năng</option>
        </select>
      </div>

      {/* Target Audience Filter */}
      <div>
        <select
          value={audienceFilter}
          onChange={(e) => onAudienceFilterChange(e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-xs bg-[#FAF5EE] dark:bg-[#142823] border border-[#C8AD8A] dark:border-[#23483E] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#D96C3B] transition-all shadow-sm"
        >
          <option value="all">Tất cả đối tượng</option>
          <option value="caregivers">Gia đình & Người chăm sóc</option>
          <option value="doctors">Bác sĩ chuyên khoa</option>
          <option value="elderly">Người cao tuổi</option>
        </select>
      </div>
    </div>
  );
};


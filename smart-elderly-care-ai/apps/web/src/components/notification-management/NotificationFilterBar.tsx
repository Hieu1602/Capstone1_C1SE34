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
    <div className="glass-card p-4 flex flex-col md:flex-row gap-3">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737780]" />
        <input
          type="text"
          placeholder="Tìm theo tiêu đề hoặc nội dung thông báo..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs bg-[#F5F6F8] dark:bg-[#202329] border border-[#E7E9ED] dark:border-[#454A53] text-[#191B20] dark:text-[#F5F6F8] placeholder:text-[#737780] dark:placeholder:text-[#727984] focus:outline-none focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35]/30 transition-all shadow-2xs"
        />
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-[#737780]" />
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs bg-[#F5F6F8] dark:bg-[#202329] border border-[#E7E9ED] dark:border-[#454A53] text-[#191B20] dark:text-[#F5F6F8] focus:outline-none focus:border-[#FF6B35] transition-all shadow-2xs cursor-pointer"
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
          className="w-full px-3 py-2 rounded-xl text-xs bg-[#F5F6F8] dark:bg-[#202329] border border-[#E7E9ED] dark:border-[#454A53] text-[#191B20] dark:text-[#F5F6F8] focus:outline-none focus:border-[#FF6B35] transition-all shadow-2xs cursor-pointer"
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
          className="w-full px-3 py-2 rounded-xl text-xs bg-[#F5F6F8] dark:bg-[#202329] border border-[#E7E9ED] dark:border-[#454A53] text-[#191B20] dark:text-[#F5F6F8] focus:outline-none focus:border-[#FF6B35] transition-all shadow-2xs cursor-pointer"
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

// src/pages/NotificationManagementPage.tsx
// Phân hệ 5: Quản lý thông báo toàn hệ thống (System Notification & Announcement Management)
// Theme: Sky Blue & White · Full Dual Light/Dark Support

import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  Send,
  Calendar,
  FileEdit,
  RotateCcw,
  Trash2,
  Search,
  Filter,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  Users,
  Stethoscope,
  HeartHandshake,
  ShieldAlert,
  Info,
  Wrench,
  Sparkles,
  RefreshCw,
  X,
  Eye,
  Check,
} from 'lucide-react';
import {
  SystemNotification,
  NotificationType,
  TargetAudience,
  NotificationStatus,
  CreateNotificationPayload,
  UpdateNotificationPayload,
} from '../types';
import { notificationsApi } from '../services/api';

const TYPE_CONFIG: Record<
  NotificationType,
  {
    label: string;
    icon: React.ElementType;
    badgeStyle: string;
    description: string;
  }
> = {
  info: {
    label: 'Thông tin chung',
    icon: Info,
    badgeStyle: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20',
    description: 'Thông báo tin tức chung và hướng dẫn sử dụng',
  },
  system_maintenance: {
    label: 'Bảo trì hệ thống',
    icon: Wrench,
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
    description: 'Cảnh báo lịch bảo trì máy chủ, backup định kỳ',
  },
  emergency: {
    label: 'Khẩn cấp / Cảnh báo',
    icon: ShieldAlert,
    badgeStyle: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20',
    description: 'Cảnh báo thời tiết cực đoan, sự cố nghiêm trọng',
  },
  health_tip: {
    label: 'Lời khuyên sức khỏe',
    icon: HeartHandshake,
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
    description: 'Khuyến cáo y tế, chế độ vận động & dinh dưỡng',
  },
  feature_update: {
    label: 'Cập nhật tính năng',
    icon: Sparkles,
    badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20',
    description: 'Ra mắt tính năng AI mới hoặc nâng cấp giao diện',
  },
};

const AUDIENCE_CONFIG: Record<
  TargetAudience,
  {
    label: string;
    icon: React.ElementType;
    badgeStyle: string;
  }
> = {
  all: {
    label: 'Tất cả người dùng',
    icon: Users,
    badgeStyle: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  caregivers: {
    label: 'Gia đình & Người chăm sóc',
    icon: HeartHandshake,
    badgeStyle: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  },
  doctors: {
    label: 'Bác sĩ chuyên khoa',
    icon: Stethoscope,
    badgeStyle: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300',
  },
  elderly: {
    label: 'Người cao tuổi',
    icon: Radio,
    badgeStyle: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  },
};

const STATUS_CONFIG: Record<
  NotificationStatus,
  {
    label: string;
    icon: React.ElementType;
    badgeStyle: string;
  }
> = {
  published: {
    label: 'Đã phát hành',
    icon: CheckCircle2,
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  },
  scheduled: {
    label: 'Đã lên lịch',
    icon: Clock,
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  },
  draft: {
    label: 'Bản nháp',
    icon: FileEdit,
    badgeStyle: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  },
  revoked: {
    label: 'Đã thu hồi',
    icon: RotateCcw,
    badgeStyle: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
  },
};

export const NotificationManagementPage: React.FC = () => {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [audienceFilter, setAudienceFilter] = useState<string>('all');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<SystemNotification | null>(null);
  const [revokingNotification, setRevokingNotification] = useState<SystemNotification | null>(null);
  const [previewNotification, setPreviewNotification] = useState<SystemNotification | null>(null);
  const [revokeReason, setRevokeReason] = useState('Nội dung đã được cập nhật phiên bản mới');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formType, setFormType] = useState<NotificationType>('info');
  const [formAudience, setFormAudience] = useState<TargetAudience>('all');
  const [formActionType, setFormActionType] = useState<'draft' | 'publish' | 'schedule'>('publish');
  const [formScheduledAt, setFormScheduledAt] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await notificationsApi.list();
      setNotifications(data);
    } catch {
      showToast('Lỗi khi tải danh sách thông báo');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      const matchSearch =
        notif.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notif.body.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || notif.status === statusFilter;
      const matchType = typeFilter === 'all' || notif.type === typeFilter;
      const matchAudience = audienceFilter === 'all' || notif.target_audience === audienceFilter;
      return matchSearch && matchStatus && matchType && matchAudience;
    });
  }, [notifications, searchTerm, statusFilter, typeFilter, audienceFilter]);

  // Statistics KPIs
  const stats = useMemo(() => {
    return {
      total: notifications.length,
      published: notifications.filter((n) => n.status === 'published').length,
      scheduled: notifications.filter((n) => n.status === 'scheduled').length,
      draft: notifications.filter((n) => n.status === 'draft').length,
      revoked: notifications.filter((n) => n.status === 'revoked').length,
      totalDelivered: notifications.reduce((acc, curr) => acc + (curr.delivered_count || 0), 0),
    };
  }, [notifications]);

  // Handlers
  const handleOpenCreateModal = () => {
    setEditingNotification(null);
    setFormTitle('');
    setFormBody('');
    setFormType('info');
    setFormAudience('all');
    setFormActionType('publish');
    // Default scheduled time: tomorrow at 08:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    setFormScheduledAt(tomorrow.toISOString().slice(0, 16));
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (notif: SystemNotification) => {
    setEditingNotification(notif);
    setFormTitle(notif.title);
    setFormBody(notif.body);
    setFormType(notif.type);
    setFormAudience(notif.target_audience);
    setFormActionType(notif.status === 'scheduled' ? 'schedule' : 'draft');
    if (notif.scheduled_at) {
      setFormScheduledAt(new Date(notif.scheduled_at).toISOString().slice(0, 16));
    }
    setIsCreateModalOpen(true);
  };

  const handleSaveNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formBody.trim()) {
      showToast('Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo');
      return;
    }

    try {
      if (editingNotification) {
        // Update existing notification
        const payload: UpdateNotificationPayload = {
          title: formTitle,
          body: formBody,
          type: formType,
          target_audience: formAudience,
        };
        if (formActionType === 'schedule' && formScheduledAt) {
          payload.status = 'scheduled';
          payload.scheduled_at = new Date(formScheduledAt).toISOString();
        } else if (formActionType === 'draft') {
          payload.status = 'draft';
        }
        await notificationsApi.update(editingNotification.id, payload);
        showToast('Cập nhật thông báo thành công');
      } else {
        // Create new
        const payload: CreateNotificationPayload = {
          title: formTitle,
          body: formBody,
          type: formType,
          target_audience: formAudience,
          status: formActionType === 'publish' ? 'published' : formActionType === 'schedule' ? 'scheduled' : 'draft',
          scheduled_at: formActionType === 'schedule' && formScheduledAt ? new Date(formScheduledAt).toISOString() : null,
        };
        await notificationsApi.create(payload);
        showToast(
          formActionType === 'publish'
            ? 'Đã phát hành thông báo thành công tới ứng dụng di động!'
            : formActionType === 'schedule'
            ? 'Đã lên lịch phát hành thông báo thành công!'
            : 'Đã lưu bản nháp thông báo!'
        );
      }
      setIsCreateModalOpen(false);
      fetchNotifications();
    } catch {
      showToast('Thao tác không thành công. Vui lòng thử lại.');
    }
  };

  const handlePublishNow = async (id: string) => {
    try {
      await notificationsApi.publish(id);
      showToast('Đã phát hành thông báo ngay lập tức và gửi Push Notification!');
      fetchNotifications();
    } catch {
      showToast('Lỗi khi phát hành thông báo');
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokingNotification) return;
    try {
      await notificationsApi.revoke(revokingNotification.id, revokeReason);
      showToast(`Đã thu hồi thông báo "${revokingNotification.title}"`);
      setRevokingNotification(null);
      fetchNotifications();
    } catch {
      showToast('Lỗi khi thu hồi thông báo');
    }
  };

  const handleDeleteNotification = async (notif: SystemNotification) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa thông báo "${notif.title}"?`)) return;
    try {
      await notificationsApi.delete(notif.id);
      showToast('Đã xóa thông báo thành công');
      fetchNotifications();
    } catch {
      showToast('Lỗi khi xóa thông báo');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 text-white dark:bg-sky-500 shadow-xl text-xs font-semibold animate-slide-up border border-white/10">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500 text-white shadow-md shadow-sky-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-heading text-slate-900 dark:text-white">
                Quản lý thông báo toàn hệ thống
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tạo, chỉnh sửa, lên lịch, phát hành và thu hồi thông báo gửi đến người dùng trong ứng dụng
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchNotifications}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-sky-200 dark:border-sky-900 bg-white dark:bg-[#0e1730] text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-500' : ''}`} />
            <span>Làm mới</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white shadow-md shadow-sky-500/25 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Tạo thông báo mới</span>
          </button>
        </div>
      </div>

      {/* ── KPI Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0e1730] border border-sky-100 dark:border-sky-950/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">Tổng thông báo</span>
            <Bell className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{stats.total}</div>
          <p className="text-[11px] text-slate-400 mt-1">Toàn bộ lịch sử thông báo</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0e1730] border border-sky-100 dark:border-sky-950/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">Đã phát hành</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {stats.published}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Đang hiển thị trên App</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0e1730] border border-sky-100 dark:border-sky-950/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">Đã lên lịch</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {stats.scheduled}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Chờ đến giờ phát hành</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0e1730] border border-sky-100 dark:border-sky-950/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">Bản nháp</span>
            <FileEdit className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-700 dark:text-slate-300">
            {stats.draft}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Đang biên soạn</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0e1730] border border-sky-100 dark:border-sky-950/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">Đã thu hồi</span>
            <RotateCcw className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {stats.revoked}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Đã hủy hoặc thu hồi</p>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0e1730] border border-sky-100 dark:border-sky-950/80 shadow-sm flex flex-col md:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tiêu đề hoặc nội dung thông báo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
            onChange={(e) => setAudienceFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">Tất cả đối tượng</option>
            <option value="caregivers">Gia đình & Người chăm sóc</option>
            <option value="doctors">Bác sĩ chuyên khoa</option>
            <option value="elderly">Người cao tuổi</option>
          </select>
        </div>
      </div>

      {/* ── Notifications Table / List ── */}
      <div className="rounded-2xl bg-white dark:bg-[#0e1730] border border-sky-100 dark:border-sky-950/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-sky-100 dark:border-sky-950/80 bg-slate-50/70 dark:bg-slate-900/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Thông báo & Phân loại</th>
                <th className="py-3.5 px-3">Đối tượng</th>
                <th className="py-3.5 px-3">Trạng thái</th>
                <th className="py-3.5 px-3">Mốc thời gian</th>
                <th className="py-3.5 px-3">Tiếp cận</th>
                <th className="py-3.5 px-4 text-right">Thao tác điều phối</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100/60 dark:divide-sky-950/60 text-xs">
              {filteredNotifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium">Không tìm thấy thông báo nào</p>
                    <p className="text-xs mt-0.5">Thử đổi bộ lọc tìm kiếm hoặc tạo thông báo mới</p>
                  </td>
                </tr>
              ) : (
                filteredNotifications.map((notif) => {
                  const typeConf = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
                  const TypeIcon = typeConf.icon;
                  const audienceConf = AUDIENCE_CONFIG[notif.target_audience] || AUDIENCE_CONFIG.all;
                  const AudienceIcon = audienceConf.icon;
                  const statusConf = STATUS_CONFIG[notif.status] || STATUS_CONFIG.draft;
                  const StatusIcon = statusConf.icon;

                  return (
                    <tr
                      key={notif.id}
                      className="hover:bg-sky-50/40 dark:hover:bg-sky-950/20 transition-colors group"
                    >
                      {/* Tiêu đề & Nội dung */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-3 max-w-md">
                          <div
                            className={`p-2 rounded-xl shrink-0 mt-0.5 border ${typeConf.badgeStyle}`}
                            title={typeConf.label}
                          >
                            <TypeIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white truncate text-xs flex items-center gap-1.5">
                              <span>{notif.title}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                              {notif.body}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${typeConf.badgeStyle}`}>
                                {typeConf.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Đối tượng */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <AudienceIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {audienceConf.label}
                          </span>
                        </div>
                      </td>

                      {/* Trạng thái */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusConf.badgeStyle}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          <span>{statusConf.label}</span>
                        </span>
                        {notif.status === 'revoked' && notif.revoke_reason && (
                          <div className="text-[10px] text-rose-500 mt-1 max-w-[160px] truncate" title={notif.revoke_reason}>
                            Lý do: {notif.revoke_reason}
                          </div>
                        )}
                      </td>

                      {/* Mốc thời gian */}
                      <td className="py-3.5 px-3">
                        <div className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                          {notif.status === 'published' && notif.published_at ? (
                            <div>
                              <span className="text-[10px] text-slate-400 block font-sans">Đã gửi:</span>
                              {new Date(notif.published_at).toLocaleString('vi-VN')}
                            </div>
                          ) : notif.status === 'scheduled' && notif.scheduled_at ? (
                            <div>
                              <span className="text-[10px] text-amber-500 block font-sans">Lịch phát:</span>
                              {new Date(notif.scheduled_at).toLocaleString('vi-VN')}
                            </div>
                          ) : notif.status === 'revoked' && notif.revoked_at ? (
                            <div>
                              <span className="text-[10px] text-rose-500 block font-sans">Thu hồi lúc:</span>
                              {new Date(notif.revoked_at).toLocaleString('vi-VN')}
                            </div>
                          ) : (
                            <div>
                              <span className="text-[10px] text-slate-400 block font-sans">Khởi tạo:</span>
                              {new Date(notif.created_at).toLocaleDateString('vi-VN')}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Tiếp cận */}
                      <td className="py-3.5 px-3">
                        {notif.status === 'published' ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span className="text-slate-700 dark:text-slate-300 font-semibold">{notif.delivered_count} đã nhận</span>
                              <span className="text-sky-600 dark:text-sky-400 font-bold">{notif.read_count} đã đọc</span>
                            </div>
                            <div className="w-24 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-sky-400 to-blue-600 rounded-full"
                                style={{
                                  width: `${Math.min(
                                    notif.delivered_count > 0 ? (notif.read_count / notif.delivered_count) * 100 : 0,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Xem trước */}
                          <button
                            onClick={() => setPreviewNotification(notif)}
                            title="Xem chi tiết"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Phát hành ngay (khi đang nháp hoặc đã lên lịch) */}
                          {(notif.status === 'draft' || notif.status === 'scheduled') && (
                            <button
                              onClick={() => handlePublishNow(notif.id)}
                              title="Phát hành ngay tới App"
                              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                            >
                              <Send className="w-3 h-3" />
                              <span>Phát hành</span>
                            </button>
                          )}

                          {/* Chỉnh sửa (khi đang nháp hoặc đã lên lịch) */}
                          {(notif.status === 'draft' || notif.status === 'scheduled') && (
                            <button
                              onClick={() => handleOpenEditModal(notif)}
                              title="Chỉnh sửa thông báo"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors cursor-pointer"
                            >
                              <FileEdit className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Thu hồi (khi đã phát hành hoặc đã lên lịch) */}
                          {(notif.status === 'published' || notif.status === 'scheduled') && (
                            <button
                              onClick={() => {
                                setRevokingNotification(notif);
                                setRevokeReason('Nội dung đã được cập nhật phiên bản mới');
                              }}
                              title="Thu hồi thông báo"
                              className="px-2 py-1.5 rounded-lg text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Thu hồi</span>
                            </button>
                          )}

                          {/* Xóa (khi là bản nháp hoặc đã thu hồi) */}
                          {(notif.status === 'draft' || notif.status === 'revoked') && (
                            <button
                              onClick={() => handleDeleteNotification(notif)}
                              title="Xóa thông báo"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* ── MODAL 1: TẠO / CHỈNH SỬA THÔNG BÁO ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#0e1730] border border-sky-100 dark:border-sky-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-sky-100 dark:border-sky-950 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-sky-500" />
                <h3 className="text-sm font-bold font-heading text-slate-900 dark:text-white">
                  {editingNotification ? 'Chỉnh sửa thông báo' : 'Soạn thông báo toàn hệ thống mới'}
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNotification} className="p-5 space-y-4">
              {/* Tiêu đề */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tiêu đề thông báo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Lịch bảo trì máy chủ định kỳ ngày 18/10"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Phân loại & Đối tượng */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phân loại thông báo
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as NotificationType)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="info">Thông tin chung</option>
                    <option value="system_maintenance">Bảo trì hệ thống</option>
                    <option value="emergency">Khẩn cấp / Cảnh báo</option>
                    <option value="health_tip">Lời khuyên sức khỏe</option>
                    <option value="feature_update">Cập nhật tính năng</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Đối tượng nhận
                  </label>
                  <select
                    value={formAudience}
                    onChange={(e) => setFormAudience(e.target.value as TargetAudience)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nội dung chi tiết <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Nhập nội dung thông báo gửi đến điện thoại người dùng..."
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Lựa chọn hình thức phát hành */}
              {!editingNotification && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Hình thức phát hành
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormActionType('publish')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        formActionType === 'publish'
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5 mb-1 text-sky-500" />
                      <div className="text-xs">Phát hành ngay</div>
                      <div className="text-[10px] opacity-75">Gửi Push FCM</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormActionType('schedule')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        formActionType === 'schedule'
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5 mb-1 text-amber-500" />
                      <div className="text-xs">Lên lịch phát</div>
                      <div className="text-[10px] opacity-75">Hẹn giờ tự động</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormActionType('draft')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        formActionType === 'draft'
                          ? 'border-slate-500 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <FileEdit className="w-3.5 h-3.5 mb-1 text-slate-400" />
                      <div className="text-xs">Lưu bản nháp</div>
                      <div className="text-[10px] opacity-75">Soạn thảo trước</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Bộ chọn thời gian hẹn giờ nếu chọn schedule */}
              {formActionType === 'schedule' && (
                <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                  <label className="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                    Chọn thời điểm phát hành tự động <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formScheduledAt}
                    onChange={(e) => setFormScheduledAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                    Hệ thống sẽ tự động kích hoạt thông báo và gửi đến điện thoại người dùng đúng thời điểm này.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-sky-100 dark:border-sky-950">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-500/25"
                >
                  {editingNotification ? 'Cập nhật thay đổi' : 'Xác nhận tạo thông báo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: XÁC NHẬN THU HỒI THÔNG BÁO ── */}
      {revokingNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0e1730] border border-rose-200 dark:border-rose-900 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Thu hồi thông báo hệ thống
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Bạn có chắc muốn thu hồi thông báo: <br />
                  <strong className="text-slate-800 dark:text-slate-200">
                    &ldquo;{revokingNotification.title}&rdquo;
                  </strong>
                  ?
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Lý do thu hồi thông báo:
              </label>
              <textarea
                rows={2}
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Nhập lý do thu hồi (sai lệch dữ liệu, hết hiệu lực, thay đổi chỉ thị...)"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRevokingNotification(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/25"
              >
                Xác nhận thu hồi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: XEM TRƯỚC / CHI TIẾT THÔNG BÁO ── */}
      {previewNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0e1730] border border-sky-100 dark:border-sky-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-sky-100 dark:border-sky-950 bg-slate-50/50 dark:bg-slate-900/50">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Mô phỏng hiển thị trên Mobile App
              </span>
              <button
                onClick={() => setPreviewNotification(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Phone notification mockup banner */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-md bg-sky-500 text-white flex items-center justify-center text-[9px] font-bold">
                      S
                    </div>
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                      SECA Hệ Thống
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">Vừa xong</span>
                </div>

                <div className="font-semibold text-xs text-slate-900 dark:text-white">
                  {previewNotification.title}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                  {previewNotification.body}
                </p>
              </div>

              {/* Metadata details */}
              <div className="space-y-2 text-xs border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-900">
                  <span className="text-slate-500">Phân loại:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {TYPE_CONFIG[previewNotification.type]?.label}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-900">
                  <span className="text-slate-500">Đối tượng:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {AUDIENCE_CONFIG[previewNotification.target_audience]?.label}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-900">
                  <span className="text-slate-500">Trạng thái:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {STATUS_CONFIG[previewNotification.status]?.label}
                  </span>
                </div>
                {previewNotification.status === 'published' && (
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-900">
                    <span className="text-slate-500">Đã gửi đến:</span>
                    <span className="font-mono font-semibold text-emerald-600">
                      {previewNotification.delivered_count} người dùng
                    </span>
                  </div>
                )}
                {previewNotification.revoke_reason && (
                  <div className="flex justify-between py-1 text-rose-600">
                    <span>Lý do thu hồi:</span>
                    <span className="font-medium text-right max-w-[200px]">
                      {previewNotification.revoke_reason}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-sky-100 dark:border-sky-950 flex justify-end">
              <button
                onClick={() => setPreviewNotification(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 text-white hover:bg-sky-600"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationManagementPage;


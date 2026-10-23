// src/pages/NotificationManagementPage.tsx
// Phân hệ 5: Quản lý thông báo toàn hệ thống (System Notification & Announcement Management)
// Theme: Sky Blue & White · Full Dual Light/Dark Support

import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  SystemNotification,
  NotificationType,
  TargetAudience,
  CreateNotificationPayload,
  UpdateNotificationPayload,
} from '../types';
import { notificationsApi } from '../services/api';
import {
  NotificationStatsCards,
  NotificationFilterBar,
  NotificationTable,
  CreateEditNotificationModal,
  RevokeNotificationModal,
  NotificationPreviewModal,
} from '../components/notification-management';

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
  const [formExpiryType, setFormExpiryType] = useState<'never' | 'preset_1h' | 'preset_24h' | 'preset_3d' | 'preset_7d' | 'custom'>('never');
  const [formExpiresAt, setFormExpiresAt] = useState('');

  const handleSelectExpiryPreset = (type: 'never' | 'preset_1h' | 'preset_24h' | 'preset_3d' | 'preset_7d' | 'custom') => {
    setFormExpiryType(type);
    const now = new Date();
    if (type === 'never') {
      setFormExpiresAt('');
    } else if (type === 'preset_1h') {
      const d = new Date(now.getTime() + 1 * 3600 * 1000);
      setFormExpiresAt(d.toISOString().slice(0, 16));
    } else if (type === 'preset_24h') {
      const d = new Date(now.getTime() + 24 * 3600 * 1000);
      setFormExpiresAt(d.toISOString().slice(0, 16));
    } else if (type === 'preset_3d') {
      const d = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
      setFormExpiresAt(d.toISOString().slice(0, 16));
    } else if (type === 'preset_7d') {
      const d = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
      setFormExpiresAt(d.toISOString().slice(0, 16));
    } else if (type === 'custom') {
      if (!formExpiresAt) {
        const d = new Date(now.getTime() + 24 * 3600 * 1000);
        setFormExpiresAt(d.toISOString().slice(0, 16));
      }
    }
  };

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
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    setFormScheduledAt(tomorrow.toISOString().slice(0, 16));
    setFormExpiryType('never');
    setFormExpiresAt('');
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (notif: SystemNotification) => {
    setEditingNotification(notif);
    setFormTitle(notif.title);
    setFormBody(notif.body);
    setFormType(notif.type);
    setFormAudience(notif.target_audience);
    setFormActionType(notif.status === 'scheduled' ? 'schedule' : 'draft');
    setFormScheduledAt(
      notif.scheduled_at ? new Date(notif.scheduled_at).toISOString().slice(0, 16) : ''
    );
    if (notif.expires_at) {
      setFormExpiryType('custom');
      setFormExpiresAt(new Date(notif.expires_at).toISOString().slice(0, 16));
    } else {
      setFormExpiryType('never');
      setFormExpiresAt('');
    }
    setIsCreateModalOpen(true);
  };

  const handleSaveNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formBody.trim()) {
      showToast('Vui lòng điền đầy đủ tiêu đề và nội dung');
      return;
    }

    try {
      if (editingNotification) {
        const payload: UpdateNotificationPayload = {
          title: formTitle,
          body: formBody,
          type: formType,
          target_audience: formAudience,
          scheduled_at: formActionType === 'schedule' && formScheduledAt ? new Date(formScheduledAt).toISOString() : undefined,
          expires_at: formExpiryType !== 'never' && formExpiresAt ? new Date(formExpiresAt).toISOString() : undefined,
        };
        const updated = await notificationsApi.update(editingNotification.id, payload);
        setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        showToast('Cập nhật thông báo thành công');
      } else {
        const payload: CreateNotificationPayload = {
          title: formTitle,
          body: formBody,
          type: formType,
          target_audience: formAudience,
          action_type: formActionType,
          scheduled_at: formActionType === 'schedule' && formScheduledAt ? new Date(formScheduledAt).toISOString() : undefined,
          expires_at: formExpiryType !== 'never' && formExpiresAt ? new Date(formExpiresAt).toISOString() : undefined,
        };
        const created = await notificationsApi.create(payload);
        setNotifications((prev) => [created, ...prev]);
        showToast(
          formActionType === 'publish'
            ? 'Đã phát hành thông báo tới toàn bộ người dùng'
            : formActionType === 'schedule'
            ? 'Đã lên lịch phát thông báo tự động'
            : 'Đã lưu bản nháp thông báo'
        );
      }
      setIsCreateModalOpen(false);
    } catch {
      showToast('Không thể lưu thông báo. Vui lòng thử lại sau.');
    }
  };

  const handlePublishNow = async (id: string) => {
    try {
      const updated = await notificationsApi.publish(id);
      setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      showToast('Đã phát hành thông báo thành công');
    } catch {
      showToast('Lỗi khi phát hành thông báo');
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokingNotification) return;
    try {
      const updated = await notificationsApi.revoke(revokingNotification.id, revokeReason);
      setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      showToast('Đã thu hồi thông báo thành công');
      setRevokingNotification(null);
    } catch {
      showToast('Lỗi khi thu hồi thông báo');
    }
  };

  const handleDeleteNotification = async (notif: SystemNotification) => {
    if (!window.confirm(`Bạn có chắc muốn xóa vĩnh viễn thông báo "${notif.title}"?`)) {
      return;
    }
    try {
      await notificationsApi.delete(notif.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      showToast('Đã xóa thông báo');
    } catch {
      showToast('Lỗi khi xóa thông báo');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Toast popup */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-2xl border border-slate-700 animate-slide-left">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-[#D96C3B]" />
            <span>Quản lý thông báo hệ thống</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Điều phối và phát hành thông báo diện rộng tới Bác sĩ, Gia đình và Người cao tuổi trên thiết bị di động
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchNotifications}
            disabled={isLoading}
            className="btn-secondary"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Tạo thông báo mới</span>
          </button>
        </div>
      </div>

      {/* ── KPI Stats Cards ── */}
      <NotificationStatsCards stats={stats} />

      {/* ── Search & Filter Controls ── */}
      <NotificationFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        audienceFilter={audienceFilter}
        onAudienceFilterChange={setAudienceFilter}
      />

      {/* ── Notifications Table / List ── */}
      <NotificationTable
        notifications={filteredNotifications}
        onPreview={(notif) => setPreviewNotification(notif)}
        onPublishNow={handlePublishNow}
        onEdit={handleOpenEditModal}
        onRevoke={(notif) => {
          setRevokingNotification(notif);
          setRevokeReason('Nội dung đã được cập nhật phiên bản mới');
        }}
        onDelete={handleDeleteNotification}
      />

      {/* ── MODAL 1: TẠO / CHỈNH SỬA THÔNG BÁO ── */}
      <CreateEditNotificationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        editingNotification={editingNotification}
        formTitle={formTitle}
        setFormTitle={setFormTitle}
        formBody={formBody}
        setFormBody={setFormBody}
        formType={formType}
        setFormType={setFormType}
        formAudience={formAudience}
        setFormAudience={setFormAudience}
        formActionType={formActionType}
        setFormActionType={setFormActionType}
        formScheduledAt={formScheduledAt}
        setFormScheduledAt={setFormScheduledAt}
        formExpiryType={formExpiryType}
        onSelectExpiryPreset={handleSelectExpiryPreset}
        formExpiresAt={formExpiresAt}
        setFormExpiresAt={setFormExpiresAt}
        onSubmit={handleSaveNotification}
      />

      {/* ── MODAL 2: XÁC NHẬN THU HỒI THÔNG BÁO ── */}
      <RevokeNotificationModal
        notification={revokingNotification}
        revokeReason={revokeReason}
        onReasonChange={setRevokeReason}
        onClose={() => setRevokingNotification(null)}
        onConfirm={handleConfirmRevoke}
      />

      {/* ── MODAL 3: XEM TRƯỚC / CHI TIẾT THÔNG BÁO ── */}
      <NotificationPreviewModal
        notification={previewNotification}
        onClose={() => setPreviewNotification(null)}
      />
    </div>
  );
};

export default NotificationManagementPage;

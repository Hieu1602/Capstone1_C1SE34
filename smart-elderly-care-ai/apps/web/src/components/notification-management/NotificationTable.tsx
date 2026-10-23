import React from 'react';
import {
  Bell,
  Eye,
  Send,
  FileEdit,
  RotateCcw,
  Trash2,
  Clock,
} from 'lucide-react';
import { SystemNotification } from '../../types';
import { TYPE_CONFIG, AUDIENCE_CONFIG, STATUS_CONFIG } from './constants';

interface NotificationTableProps {
  notifications: SystemNotification[];
  onPreview: (notification: SystemNotification) => void;
  onPublishNow: (id: string) => void;
  onEdit: (notification: SystemNotification) => void;
  onRevoke: (notification: SystemNotification) => void;
  onDelete: (notification: SystemNotification) => void;
}

export const NotificationTable: React.FC<NotificationTableProps> = ({
  notifications,
  onPreview,
  onPublishNow,
  onEdit,
  onRevoke,
  onDelete,
}) => {
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#C8AD8A] dark:border-white/10 bg-[#FFF8EE] dark:bg-[#1A3830] text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              <th className="py-3.5 px-4">Thông báo & Phân loại</th>
              <th className="py-3.5 px-3">Đối tượng</th>
              <th className="py-3.5 px-3">Trạng thái</th>
              <th className="py-3.5 px-3">Thời gian gửi</th>
              <th className="py-3.5 px-3">Thời gian hết hạn</th>
              <th className="py-3.5 px-4 text-right">Thao tác điều phối</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#C8AD8A]/30 dark:divide-white/5 text-xs">
            {notifications.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#D96C3B]" />
                  <p className="text-sm font-semibold">Không tìm thấy thông báo nào</p>
                  <p className="text-xs mt-0.5">Thử đổi bộ lọc tìm kiếm hoặc tạo thông báo mới</p>
                </td>
              </tr>
            ) : (
              notifications.map((notif) => {
                const typeConf = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
                const TypeIcon = typeConf.icon;
                const audienceConf = AUDIENCE_CONFIG[notif.target_audience] || AUDIENCE_CONFIG.all;
                const AudienceIcon = audienceConf.icon;
                const statusConf = STATUS_CONFIG[notif.status] || STATUS_CONFIG.draft;
                const StatusIcon = statusConf.icon;

                return (
                  <tr
                    key={notif.id}
                    className="table-row-glass group"
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
                          <div className="font-bold text-slate-900 dark:text-white truncate text-xs flex items-center gap-1.5">
                            <span>{notif.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {notif.body}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${typeConf.badgeStyle}`}>
                              {typeConf.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Đối tượng */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <AudienceIcon className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                          {audienceConf.label}
                        </span>
                      </div>
                    </td>

                    {/* Trạng thái */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusConf.badgeStyle}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        <span>{statusConf.label}</span>
                      </span>
                      {notif.status === 'revoked' && notif.revoke_reason && (
                        <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 max-w-[160px] truncate" title={notif.revoke_reason}>
                          Lý do: {notif.revoke_reason}
                        </div>
                      )}
                    </td>

                    {/* Thời gian gửi */}
                    <td className="py-3.5 px-3">
                      <div className="text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                        {notif.status === 'published' && notif.published_at ? (
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {new Date(notif.published_at).toLocaleString('vi-VN')}
                            </div>
                            <span className="text-[10px] text-slate-500 font-sans block mt-0.5">
                              Đã phát hành
                            </span>
                          </div>
                        ) : notif.status === 'scheduled' && notif.scheduled_at ? (
                          <div>
                            <div className="font-semibold text-amber-700 dark:text-amber-300">
                              {new Date(notif.scheduled_at).toLocaleString('vi-VN')}
                            </div>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-sans block mt-0.5">
                              Lịch hẹn phát
                            </span>
                          </div>
                        ) : notif.status === 'revoked' && notif.revoked_at ? (
                          <div>
                            <div className="text-slate-500 line-through">
                              {notif.published_at
                                ? new Date(notif.published_at).toLocaleString('vi-VN')
                                : new Date(notif.created_at).toLocaleString('vi-VN')}
                            </div>
                            <span className="text-[10px] text-rose-500 font-sans block mt-0.5">
                              Thu hồi lúc {new Date(notif.revoked_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold">{new Date(notif.created_at).toLocaleString('vi-VN')}</div>
                            <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                              Bản nháp
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Thời gian hết hạn */}
                    <td className="py-3.5 px-3">
                      {notif.expires_at ? (
                        new Date(notif.expires_at) < new Date() ? (
                          <div>
                            <div className="font-mono text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                              {new Date(notif.expires_at).toLocaleString('vi-VN')}
                            </div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded mt-0.5 font-sans">
                              <Clock className="w-2.5 h-2.5" />
                              <span>Đã hết hạn</span>
                            </span>
                          </div>
                        ) : (
                          <div>
                            <div className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                              {new Date(notif.expires_at).toLocaleString('vi-VN')}
                            </div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded mt-0.5 font-sans">
                              <Clock className="w-2.5 h-2.5" />
                              <span>Đang áp dụng</span>
                            </span>
                          </div>
                        )
                      ) : (
                        <div>
                          <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            Vĩnh viễn
                          </div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-sans mt-0.5">
                            Không giới hạn
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Thao tác */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Xem trước */}
                        <button
                          onClick={() => onPreview(notif)}
                          title="Xem chi tiết"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#D96C3B] hover:bg-[#D96C3B]/10 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Phát hành ngay (khi đang nháp hoặc đã lên lịch) */}
                        {(notif.status === 'draft' || notif.status === 'scheduled') && (
                          <button
                            onClick={() => onPublishNow(notif.id)}
                            title="Phát hành ngay tới App"
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>Phát hành</span>
                          </button>
                        )}

                        {/* Chỉnh sửa (khi đang nháp hoặc đã lên lịch) */}
                        {(notif.status === 'draft' || notif.status === 'scheduled') && (
                          <button
                            onClick={() => onEdit(notif)}
                            title="Chỉnh sửa thông báo"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#D96C3B] hover:bg-[#D96C3B]/10 transition-colors cursor-pointer"
                          >
                            <FileEdit className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Thu hồi (khi đã phát hành hoặc đã lên lịch) */}
                        {(notif.status === 'published' || notif.status === 'scheduled') && (
                          <button
                            onClick={() => onRevoke(notif)}
                            title="Thu hồi thông báo"
                            className="px-2 py-1.5 rounded-lg text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1 transition-colors cursor-pointer border border-rose-200 dark:border-rose-900"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Thu hồi</span>
                          </button>
                        )}

                        {/* Xóa (khi là bản nháp hoặc đã thu hồi) */}
                        {(notif.status === 'draft' || notif.status === 'revoked') && (
                          <button
                            onClick={() => onDelete(notif)}
                            title="Xóa thông báo"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
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
  );
};


// src/components/clinical/NotificationDetailModal.tsx
// Modal chi tiết thông báo lâm sàng & cảnh báo y tế dành cho Bác sĩ gia đình
// Tích hợp đồng bộ dữ liệu tức thời qua WebSocket Backend

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  AlertTriangle,
  Calendar,
  Clock,
  Heart,
  Activity,
  User,
  CheckCircle2,
  ShieldAlert,
  MailCheck,
  Check,
  ChevronRight,
  Stethoscope,
  Megaphone,
  Shield,
} from 'lucide-react';
import type { Incident, SystemNotification } from '../../types';

export interface UnifiedNotification {
  id: string;
  rawIncidentId?: string;
  type: 'ALERT' | 'APPOINTMENT' | 'INVITE' | 'ADMIN';
  title: string;
  subtitle: string;
  timeStr: string;
  badgeLabel: string;
  badgeColor: string;
  badgeBg: string;
  isRead: boolean;
  targetUrl: string;
  patientId?: string;
  patientName?: string;
  patientMrCode?: string;
  repeatCount?: number;
  repeatBadge?: string;
  patientAddress?: string;
  heartRate?: number;
  spo2?: number;
  alertLevel?: string;
  alertType?: string;
  rawIncident?: Incident;
  adminNotification?: SystemNotification;
}

interface NotificationDetailModalProps {
  isOpen: boolean;
  notif: UnifiedNotification | null;
  onClose: () => void;
  onAcknowledge?: (item: UnifiedNotification) => Promise<void> | void;
  onNavigate?: (url: string) => void;
  onRespondInvite?: (incident: Incident, action: 'accept' | 'reject') => Promise<void>;
}

export const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  isOpen,
  notif,
  onClose,
  onAcknowledge,
  onNavigate,
  onRespondInvite,
}) => {
  const [processing, setProcessing] = useState(false);
  const [handled, setHandled] = useState(false);

  // Hỗ trợ phím Escape đóng modal
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isOpen]);

  if (!isOpen || !notif) return null;

  const isCritical =
    notif.alertLevel === 'CRITICAL' ||
    notif.alertType === 'FALL_DETECTED' ||
    notif.badgeLabel === 'Khẩn cấp' ||
    notif.title.toLowerCase().includes('té ngã');

  const isWarning =
    notif.alertLevel === 'WARNING' ||
    notif.badgeLabel === 'Cảnh báo' ||
    notif.badgeLabel === 'Cần chú ý';

  const isInvite = notif.type === 'INVITE';
  const isAppointment = notif.type === 'APPOINTMENT';
  const isAdmin = notif.type === 'ADMIN';

  const isAlreadyHandled =
    handled ||
    Boolean(notif.rawIncident?.is_acknowledged) ||
    notif.badgeLabel === 'Đã xử lý' ||
    notif.badgeLabel === 'Đã tham gia' ||
    notif.badgeLabel === 'Đã khám';

  const handleAcknowledgeClick = async () => {
    if (!onAcknowledge || isAlreadyHandled) return;
    setProcessing(true);
    try {
      await onAcknowledge(notif);
      setHandled(true);
    } catch (err) {
      console.warn('Lỗi xử lý thông báo:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleJumpToDetails = () => {
    onClose();
    if (onNavigate && notif.targetUrl) {
      onNavigate(notif.targetUrl);
    }
  };

  const handleInviteAction = async (action: 'accept' | 'reject') => {
    if (!notif.rawIncident || !onRespondInvite) return;
    setProcessing(true);
    try {
      await onRespondInvite(notif.rawIncident, action);
      setHandled(true);
    } catch (err) {
      console.warn('Lỗi phản hồi lời mời:', err);
    } finally {
      setProcessing(false);
    }
  };

  // Khuyến nghị chuyên môn lâm sàng dựa trên loại cảnh báo
  const getClinicalAdvice = () => {
    if (isAdmin) {
      return 'Thông báo chỉ đạo nghiệp vụ, bảo trì hoặc hướng dẫn y tế từ Quản trị viên hệ thống SECA. Bác sĩ vui lòng lưu ý để phục vụ công tác chăm sóc người cao tuổi.';
    }
    if (isCritical) {
      return 'Khẩn cấp: Phát hiện nguy cơ té ngã hoặc suy giảm sinh hiệu nghiêm trọng. Bác sĩ hoặc nhân viên y tế cần liên hệ ngay số khẩn cấp của gia đình hoặc điều phối sơ cứu 115.';
    }
    if (isWarning) {
      return 'Cảnh báo lâm sàng: Chỉ số sinh hiệu (nhịp tim / SpO2) lệch ngoài ngưỡng an toàn tiêu chuẩn. Khuyến nghị kiểm tra triệu chứng tức ngực, khó thở hoặc kiểm tra vị trí đeo vòng BLE.';
    }
    if (isInvite) {
      return 'Lời mời phụ trách Bác sĩ gia đình: Sau khi xác nhận, bác sĩ sẽ được cấp quyền theo dõi sinh hiệu thời gian thực và quản lý đơn thuốc điều trị của người cao tuổi trong căn nhà này.';
    }
    if (isAppointment) {
      return 'Lịch khám bệnh nhân: Vui lòng xem trước hồ sơ bệnh án, lịch sử đơn thuốc và chuẩn bị các trang thiết bị kiểm tra lâm sàng cần thiết trước giờ hẹn.';
    }
    return 'Thông báo cập nhật từ hệ thống giám sát y tế gia đình SECA AI. Dữ liệu được đồng bộ hóa tức thời.';
  };

  // Chỉ hiển thị khung sinh hiệu khi có cảnh báo sức khỏe thực tế (không hiển thị cho lịch khám hay lời mời)
  const hasVitals =
    notif.type === 'ALERT' &&
    ((Boolean(notif.heartRate && notif.heartRate > 0)) ||
      (Boolean(notif.spo2 && notif.spo2 > 0)) ||
      isCritical ||
      isWarning);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] !mt-0 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-[101] flex max-h-[88vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden dark:bg-slate-900 dark:border-slate-800 my-auto">
        {/* Header Modal - Cố định ở đầu modal */}
        <div
          className={`shrink-0 flex items-center justify-between border-b px-6 py-4 ${
            isAdmin
              ? 'bg-sky-50/90 border-sky-100 dark:bg-sky-950/40 dark:border-sky-900/40'
              : isCritical
                ? 'bg-rose-50/90 border-rose-100 dark:bg-rose-950/40 dark:border-rose-900/40'
                : isWarning
                  ? 'bg-amber-50/90 border-amber-100 dark:bg-amber-950/40 dark:border-amber-900/40'
                  : isInvite
                    ? 'bg-emerald-50/90 border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900/40'
                    : 'bg-blue-50/90 border-blue-100 dark:bg-blue-950/40 dark:border-blue-900/40'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-xs shrink-0 ${
                isAdmin
                  ? 'bg-sky-600 text-white'
                  : isCritical
                    ? 'bg-rose-600 text-white'
                    : isWarning
                      ? 'bg-amber-500 text-white'
                      : isInvite
                        ? 'bg-emerald-600 text-white'
                        : 'bg-blue-600 text-white'
              }`}
            >
              {isAdmin ? (
                <Megaphone className="h-6 w-6" />
              ) : isCritical ? (
                <ShieldAlert className="h-6 w-6 animate-pulse" />
              ) : isWarning ? (
                <AlertTriangle className="h-6 w-6" />
              ) : isInvite ? (
                <MailCheck className="h-6 w-6" />
              ) : (
                <Calendar className="h-6 w-6" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-bold tracking-wide uppercase border ${
                    isAdmin
                      ? 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/60 dark:text-sky-200'
                      : isCritical
                        ? 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/60 dark:text-rose-200'
                        : isWarning
                          ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/60 dark:text-amber-200'
                          : isInvite
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-200'
                            : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/60 dark:text-blue-200'
                  }`}
                >
                  {notif.badgeLabel || (isAdmin ? 'Thông báo Admin' : isCritical ? 'Khẩn cấp' : 'Thông báo')}
                </span>
                {isAlreadyHandled ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" /> Đã xử lý
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                    {isAdmin ? 'Thông báo mở' : 'Chờ tiếp nhận'}
                  </span>
                )}
              </div>
              <h3 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                {isAdmin ? 'Thông Báo Từ Quản Trị Viên Hệ Thống' : 'Chi tiết Thông Báo Lâm Sàng'}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-slate-700 transition-colors dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="Đóng cửa sổ"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Thân Modal - Cuộn độc lập */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-slate-800 dark:text-slate-200">
          {/* Tiêu đề chính & thời gian */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <h4 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
              {notif.title}
            </h4>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {notif.subtitle}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                Thời gian: <strong className="text-slate-700 dark:text-slate-300">{notif.timeStr}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Đồng bộ thời gian thực
              </span>
            </div>
          </div>

          {/* Thẻ phát hành Admin (chỉ hiển thị khi là thông báo từ Admin) */}
          {isAdmin && (
            <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 dark:border-sky-900/30 dark:bg-sky-950/20">
              <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 mb-2 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" /> Thông tin phát hành từ Quản trị viên
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Đơn vị gửi:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    Ban Quản Trị Hệ Thống SECA (System Admin)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Nhóm đối tượng nhận:</span>
                  <span className="font-semibold text-sky-700 dark:text-sky-300">
                    {notif.adminNotification?.target_audience === 'doctors'
                      ? 'Bác sĩ Gia đình'
                      : notif.adminNotification?.target_audience === 'caregivers'
                        ? 'Gia đình & Người chăm sóc'
                        : 'Toàn bộ hệ thống & Bác sĩ'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Kênh phát hành:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Phát sóng trực tiếp (Active Broadcast)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Thẻ bệnh nhân & địa chỉ (nếu có thông tin) */}
          {!isAdmin && (notif.patientName || notif.patientAddress || notif.patientId) && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 dark:border-blue-900/30 dark:bg-blue-950/20">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Thông tin bệnh nhân phụ trách
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Họ và tên &amp; Mã hồ sơ:</span>
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    {notif.patientName || 'Người cao tuổi'}
                    {notif.patientMrCode && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                        {notif.patientMrCode}
                      </span>
                    )}
                  </span>
                </div>
                {notif.repeatBadge && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Tần suất cảnh báo:</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      {notif.repeatBadge}
                    </span>
                  </div>
                )}
                {notif.patientAddress && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Khu vực / Nhà:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 text-right truncate max-w-[240px]">
                      {notif.patientAddress}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Thiết bị giám sát:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    CooSpo HW706 BLE Smartband (Online)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Thẻ chỉ số sinh hiệu (Chỉ hiển thị khi có cảnh báo sức khỏe thực tế, ẩn khi là Lịch khám) */}
          {hasVitals && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-rose-500" /> Chỉ số sinh hiệu tại thời điểm phát hiện
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5 text-rose-500 animate-pulse" /> Nhịp tim
                    </span>
                    <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400 bg-rose-100/80 px-1.5 py-0.5 rounded">
                      Realtime
                    </span>
                  </div>
                  <p className="mt-1 text-xl font-extrabold text-rose-700 dark:text-rose-300">
                    {notif.heartRate && notif.heartRate > 0 ? notif.heartRate : '—'}{' '}
                    <span className="text-xs font-medium text-slate-500">bpm</span>
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5 text-emerald-500" /> Nồng độ oxy SpO2
                    </span>
                    <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                      {notif.spo2 && notif.spo2 > 0 ? (notif.spo2 < 95 ? 'Thấp' : 'Ổn định') : 'Chưa đo'}
                    </span>
                  </div>
                  <p className="mt-1 text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
                    {notif.spo2 && notif.spo2 > 0 ? notif.spo2 : '—'}{' '}
                    <span className="text-xs font-medium text-slate-500">%</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Hướng dẫn xử lý lâm sàng (chỉ hiển thị cho cảnh báo y khoa, ẩn khi là thông báo Admin) */}
          {!isAdmin && (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700/80 dark:bg-slate-800/60">
              <div className="flex items-start gap-2.5">
                <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    Khuyến nghị chuyên môn Bác sĩ
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {getClinicalAdvice()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions - Cố định ở cuối modal (chỉ dành cho cảnh báo y tế / lâm sàng / lời mời) */}
        {!isAdmin && (
          <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {isAlreadyHandled ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" />
                  {notif.rawIncident?.acknowledged_by_name
                    ? `Đã xử lý bởi ${notif.rawIncident.acknowledged_by_name}`
                    : notif.rawIncident?.acknowledged_by && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(notif.rawIncident.acknowledged_by))
                    ? `Đã xử lý bởi ${notif.rawIncident.acknowledged_by}`
                    : 'Bác sĩ đã xác nhận & xử lý'}
                </span>
              ) : (
                <span>Cần xác nhận xử lý y khoa</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isInvite && !isAlreadyHandled && (
                <>
                  <button
                    onClick={() => handleInviteAction('reject')}
                    disabled={processing}
                    className="rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors dark:border-rose-800 dark:bg-slate-800 dark:text-rose-300"
                  >
                    Từ chối
                  </button>
                  <button
                    onClick={() => handleInviteAction('accept')}
                    disabled={processing}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition-all"
                  >
                    Đồng ý phụ trách
                  </button>
                </>
              )}

              {!isInvite && !isAlreadyHandled && notif.rawIncidentId && (
                <button
                  onClick={handleAcknowledgeClick}
                  disabled={processing}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {processing ? 'Đang xác nhận...' : 'Xác nhận đã xử lý'}
                </button>
              )}

              {notif.targetUrl && (
                <button
                  onClick={handleJumpToDetails}
                  className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <span>Xem chi tiết</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                onClick={onClose}
                className="rounded-xl border border-transparent bg-slate-200/80 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300/80 transition-colors dark:bg-slate-800 dark:text-slate-300"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

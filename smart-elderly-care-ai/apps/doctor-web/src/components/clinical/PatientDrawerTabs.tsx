import React from 'react';
import { Activity, FileText, Pill, Calendar, Plus, LucideIcon } from 'lucide-react';
import { PrescriptionItem, AppointmentItem, AnalyticsData } from '../../types';
import { VitalsTrendChart } from './VitalsTrendChart';

export type DrawerTabKey = 'RECORD' | 'VITALS' | 'PRESCRIPTIONS' | 'APPOINTMENTS';

interface PatientDrawerTabBarProps {
  activeTab: DrawerTabKey;
  prescriptionsCount: number;
  appointmentsCount: number;
  onSelectTab: (tab: DrawerTabKey) => void;
}

export const PatientDrawerTabBar: React.FC<PatientDrawerTabBarProps> = ({
  activeTab,
  prescriptionsCount,
  appointmentsCount,
  onSelectTab,
}) => {
  const drawerTabs: { key: DrawerTabKey; label: string; icon: LucideIcon; count?: number }[] = [
    { key: 'RECORD', label: 'Hồ sơ Bệnh án', icon: FileText },
    { key: 'VITALS', label: 'Đồ thị Sinh hiệu', icon: Activity },
    { key: 'PRESCRIPTIONS', label: 'Đơn thuốc', icon: Pill, count: prescriptionsCount },
    { key: 'APPOINTMENTS', label: 'Lịch khám', icon: Calendar, count: appointmentsCount },
  ];

  return (
    <div className="border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-[#131C31] px-6 py-2.5">
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-slate-100/80 p-1 border border-slate-200/50 dark:bg-[#0F172A] dark:border-slate-800">
        {drawerTabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onSelectTab(t.key)}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-blue-600 dark:text-white' : 'text-slate-400'}`} />
              <span className="truncate">{t.label}</span>
              {t.count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                    isActive
                      ? 'bg-blue-100 dark:bg-blue-500 text-blue-700 dark:text-white'
                      : 'bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface PatientDrawerVitalsTabProps {
  analytics: AnalyticsData | null;
  isLoading: boolean;
}

export const PatientDrawerVitalsTab: React.FC<PatientDrawerVitalsTabProps> = ({
  analytics,
  isLoading,
}) => {
  if (isLoading && !analytics) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="h-64 w-full rounded-2xl bg-slate-100 dark:bg-[#0F172A] border border-slate-200/70 dark:border-slate-800" />
      </div>
    );
  }
  return <VitalsTrendChart data={analytics?.daily_trends || []} days={7} />;
};

interface TabListSectionProps {
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
  isLoading: boolean;
  isEmpty: boolean;
  skeletonHeightClass: string;
  emptyText: string;
  children: React.ReactNode;
}

const TabListSection: React.FC<TabListSectionProps> = ({
  title,
  subtitle,
  actionLabel,
  onAction,
  isLoading,
  isEmpty,
  skeletonHeightClass,
  emptyText,
  children,
}) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
          {title}
        </h4>
        <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="flex items-center space-x-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>{actionLabel}</span>
      </button>
    </div>

    {isLoading && isEmpty ? (
      <div className="space-y-2.5 animate-pulse">
        {[1, 2].map((i) => (
          <div
            key={i}
            className={`${skeletonHeightClass} rounded-2xl bg-slate-100 dark:bg-[#0F172A] border border-slate-200/70 dark:border-slate-800`}
          />
        ))}
      </div>
    ) : isEmpty ? (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/80 p-8 text-center text-xs text-slate-400 bg-slate-50/50 dark:bg-[#0F172A]/50">
        {emptyText}
      </div>
    ) : (
      <div className="space-y-2.5">{children}</div>
    )}
  </div>
);

interface PatientDrawerPrescriptionsTabProps {
  prescriptions: PrescriptionItem[];
  isLoading: boolean;
  onOpenPrescriptionModal: () => void;
}

export const PatientDrawerPrescriptionsTab: React.FC<PatientDrawerPrescriptionsTabProps> = ({
  prescriptions,
  isLoading,
  onOpenPrescriptionModal,
}) => (
  <TabListSection
    title={`Thuốc đang sử dụng (${prescriptions.length})`}
    subtitle="Phác đồ dùng thuốc đang kích hoạt đồng bộ loa Hub"
    actionLabel="Kê đơn thuốc mới"
    onAction={onOpenPrescriptionModal}
    isLoading={isLoading}
    isEmpty={prescriptions.length === 0}
    skeletonHeightClass="h-24"
    emptyText="Chưa có đơn thuốc nào. Bấm nút Kê đơn thuốc mới ở trên để thêm."
  >
    {prescriptions.map((rx) => (
      <div
        key={rx.id}
        className="rounded-2xl border border-slate-200/80 bg-white dark:bg-[#0F172A] dark:border-slate-800/80 p-4 shadow-xs"
      >
        <div className="flex items-center justify-between">
          <span className="font-extrabold text-slate-900 dark:text-white text-xs">{rx.medication_name}</span>
          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60">
            {rx.dosage}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {rx.frequency} • {rx.instructions}
        </p>
        <div className="mt-2.5 flex items-center justify-between text-[11px] border-t border-slate-100 dark:border-slate-800 pt-2">
          <span className="text-slate-400">Giờ uống: {rx.schedule_times?.join(', ')}</span>
          {rx.enable_speaker_reminder && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 font-bold border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
              Loa nhắc: Đang bật
            </span>
          )}
        </div>
      </div>
    ))}
  </TabListSection>
);

const APPOINTMENT_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  COMPLETED: {
    label: 'Đã khám xong',
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/60',
  },
  CANCELLED: {
    label: 'Đã hủy',
    className:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/60',
  },
};

const DEFAULT_APPOINTMENT_BADGE = {
  label: 'Sắp tới',
  className:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900/60',
};

interface PatientDrawerAppointmentsTabProps {
  appointments: AppointmentItem[];
  isLoading: boolean;
  onOpenAppointmentModal: () => void;
}

export const PatientDrawerAppointmentsTab: React.FC<PatientDrawerAppointmentsTabProps> = ({
  appointments,
  isLoading,
  onOpenAppointmentModal,
}) => (
  <TabListSection
    title="Lịch khám của bệnh nhân"
    subtitle="Lịch thăm khám định kỳ và tái khám tại nhà"
    actionLabel="Hẹn lịch khám mới"
    onAction={onOpenAppointmentModal}
    isLoading={isLoading}
    isEmpty={appointments.length === 0}
    skeletonHeightClass="h-20"
    emptyText="Chưa có lịch khám nào với bệnh nhân này."
  >
    {appointments.map((apt) => {
      const badge = APPOINTMENT_STATUS_BADGE[apt.status] ?? DEFAULT_APPOINTMENT_BADGE;
      return (
        <div
          key={apt.id}
          className="rounded-2xl border border-slate-200/80 bg-white dark:bg-[#0F172A] dark:border-slate-800/80 p-4 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-slate-900 dark:text-white text-xs">
              {apt.clinical_notes || 'Khám sức khỏe'}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {new Date(apt.scheduled_at).toLocaleString('vi-VN')} • {apt.location}
          </p>
        </div>
      );
    })}
  </TabListSection>
);

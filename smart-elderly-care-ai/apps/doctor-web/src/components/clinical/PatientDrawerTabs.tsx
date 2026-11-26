import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Activity,
  FileText,
  Pill,
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LucideIcon,
} from 'lucide-react';
import { PrescriptionItem, AppointmentItem, AnalyticsData } from '../../types';
import { VitalsTrendChart, VitalMetricKey } from './VitalsTrendChart';
import {
  VitalFilterState,
  VitalRangeMode,
  computeVitalFilter,
  formatDMY,
  formatVietnameseWeekdayDMY,
  formatYMD,
  getTodayYMD,
  parseYMD,
  stepVitalFilter,
} from '../../utils/dateFilter';

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
  vitalFilter?: VitalFilterState;
  onVitalFilterChange?: (next: VitalFilterState) => void;
}

const METRIC_OPTIONS: { key: VitalMetricKey; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'HR', label: 'Nhịp tim (bpm)' },
  { key: 'SPO2', label: 'SpO₂ (%)' },
  { key: 'BP', label: 'Huyết áp (mmHg)' },
  { key: 'TEMP', label: 'Nhiệt độ (°C)' },
];

export const PatientDrawerVitalsTab: React.FC<PatientDrawerVitalsTabProps> = ({
  analytics,
  isLoading,
  vitalFilter,
  onVitalFilterChange,
}) => {
  const [localFilter, setLocalFilter] = useState<VitalFilterState>(() =>
    computeVitalFilter('WEEK', getTodayYMD())
  );
  const activeFilter = vitalFilter || localFilter;
  const applyFilter = (next: VitalFilterState) => {
    setLocalFilter(next);
    onVitalFilterChange?.(next);
  };

  const [selectedMetric, setSelectedMetric] = useState<VitalMetricKey>('ALL');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'DAY' | 'MONTH_YEAR'>('DAY');
  const [viewMonthDate, setViewMonthDate] = useState<Date>(() =>
    parseYMD(activeFilter.selectedDate)
  );
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    };
    if (calendarOpen) {
      document.addEventListener('mousedown', onOutside);
    }
    return () => document.removeEventListener('mousedown', onOutside);
  }, [calendarOpen]);

  const todayYMD = getTodayYMD();

  const canStepForward = useMemo(() => {
    const stepped = stepVitalFilter(activeFilter, 1);
    return (
      stepped.selectedDate !== activeFilter.selectedDate ||
      stepped.startDate !== activeFilter.startDate
    );
  }, [activeFilter]);

  const displayRangeLabel = useMemo(() => {
    if (activeFilter.mode === 'DAY') {
      return formatVietnameseWeekdayDMY(activeFilter.selectedDate);
    }
    if (activeFilter.mode === 'WEEK') {
      const start = activeFilter.startDate
        ? formatDMY(parseYMD(activeFilter.startDate))
        : '';
      const end = activeFilter.endDate
        ? formatDMY(parseYMD(activeFilter.endDate))
        : '';
      return `${start} – ${end}`;
    }
    const d = parseYMD(activeFilter.selectedDate);
    return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
  }, [activeFilter]);

  const calendarCells = useMemo(() => {
    const y = viewMonthDate.getFullYear();
    const m = viewMonthDate.getMonth();
    const firstRaw = new Date(y, m, 1).getDay();
    const firstOffset = firstRaw === 0 ? 6 : firstRaw - 1;
    const totalDays = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: firstOffset + totalDays }, (_, idx) => {
      const isCurrentMonth = idx >= firstOffset;
      const dayNum = idx - firstOffset + 1;
      const d = new Date(y, m, dayNum);
      const ymd = formatYMD(d);
      const isFuture = ymd > todayYMD;
      const isSelected =
        isCurrentMonth &&
        (activeFilter.mode === 'WEEK' && activeFilter.startDate && activeFilter.endDate
          ? ymd >= activeFilter.startDate && ymd <= activeFilter.endDate
          : ymd === activeFilter.selectedDate);
      return { isCurrentMonth, dayNum, ymd, isFuture, isSelected };
    });
  }, [viewMonthDate, todayYMD, activeFilter]);

  return (
    <div className="space-y-4">
      {/* Thanh công cụ lọc thời gian & chỉ số sinh hiệu */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 space-y-3 dark:border-slate-800 dark:bg-[#0F172A]">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Segmented Control: Theo ngày | Theo tuần | Theo tháng */}
          <div className="inline-flex rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
            {(
              [
                { key: 'DAY' as VitalRangeMode, label: 'Theo ngày' },
                { key: 'WEEK' as VitalRangeMode, label: 'Theo tuần' },
                { key: 'MONTH' as VitalRangeMode, label: 'Theo tháng' },
              ]
            ).map((opt) => {
              const active = activeFilter.mode === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() =>
                    applyFilter(computeVitalFilter(opt.key, activeFilter.selectedDate))
                  }
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    active
                      ? 'bg-white text-blue-600 shadow-2xs dark:bg-blue-600 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Bộ điều hướng & Custom Calendar Popover */}
          <div className="relative flex items-center gap-1.5" ref={popoverRef}>
            <button
              type="button"
              onClick={() => applyFilter(stepVitalFilter(activeFilter, -1))}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
              title="Lùi mốc thời gian"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMonthDate(parseYMD(activeFilter.selectedDate));
                setPickerMode(activeFilter.mode === 'MONTH' ? 'MONTH_YEAR' : 'DAY');
                setCalendarOpen((prev) => !prev);
              }}
              className="flex h-8 items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 text-xs font-bold text-slate-800 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
            >
              <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>{displayRangeLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            <button
              type="button"
              disabled={!canStepForward}
              onClick={() => applyFilter(stepVitalFilter(activeFilter, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
              title="Tiến mốc thời gian"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {calendarOpen && (
              <div className="absolute right-0 top-10 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl dark:border-slate-700 dark:bg-[#1E293B]">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setPickerMode((m) => (m === 'DAY' ? 'MONTH_YEAR' : 'DAY'))
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-blue-600 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 cursor-pointer"
                  >
                    <span>
                      Tháng {viewMonthDate.getMonth() + 1}/{viewMonthDate.getFullYear()}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        pickerMode === 'MONTH_YEAR' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setViewMonthDate(
                          new Date(
                            viewMonthDate.getFullYear(),
                            viewMonthDate.getMonth() - (pickerMode === 'MONTH_YEAR' ? 12 : 1),
                            1
                          )
                        )
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setViewMonthDate(
                          new Date(
                            viewMonthDate.getFullYear(),
                            viewMonthDate.getMonth() + (pickerMode === 'MONTH_YEAR' ? 12 : 1),
                            1
                          )
                        )
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {pickerMode === 'MONTH_YEAR' ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-center gap-1.5">
                      {[2024, 2025, 2026, 2027].map((yr) => {
                        const activeYr = viewMonthDate.getFullYear() === yr;
                        return (
                          <button
                            key={yr}
                            type="button"
                            onClick={() =>
                              setViewMonthDate(new Date(yr, viewMonthDate.getMonth(), 1))
                            }
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer ${
                              activeYr
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {yr}
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {Array.from({ length: 12 }, (_, mIdx) => {
                        const activeM = viewMonthDate.getMonth() === mIdx;
                        return (
                          <button
                            key={mIdx}
                            type="button"
                            onClick={() => {
                              const picked = new Date(viewMonthDate.getFullYear(), mIdx, 1);
                              setViewMonthDate(picked);
                              if (activeFilter.mode === 'MONTH') {
                                applyFilter(computeVitalFilter('MONTH', formatYMD(picked)));
                                setCalendarOpen(false);
                              } else {
                                setPickerMode('DAY');
                              }
                            }}
                            className={`rounded-lg py-1.5 text-xs font-bold cursor-pointer ${
                              activeM
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-50 text-slate-700 hover:bg-blue-50 dark:bg-slate-800 dark:text-slate-200'
                            }`}
                          >
                            T{mIdx + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-bold text-slate-400">
                      {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
                        <span key={d}>{d}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-0.5 text-center">
                      {calendarCells.map((cell, idx) => (
                        <button
                          key={idx}
                          type="button"
                          disabled={!cell.isCurrentMonth || cell.isFuture}
                          onClick={() => {
                            applyFilter(
                              computeVitalFilter(activeFilter.mode, cell.ymd)
                            );
                            setCalendarOpen(false);
                          }}
                          className={`h-8 w-8 rounded-full text-xs font-semibold transition cursor-pointer ${
                            !cell.isCurrentMonth
                              ? 'invisible'
                              : cell.isFuture
                                ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                : cell.isSelected
                                  ? 'bg-blue-600 font-bold text-white'
                                  : 'text-slate-700 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {cell.isCurrentMonth ? cell.dayNum : ''}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Thanh chọn chỉ số sinh hiệu */}
        <div className="flex flex-wrap items-center gap-1.5">
          {METRIC_OPTIONS.map((m) => {
            const active = selectedMetric === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelectedMetric(m.key)}
                className={`rounded-xl px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && !analytics ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-6 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-64 w-full rounded-2xl bg-slate-100 dark:bg-[#0F172A] border border-slate-200/70 dark:border-slate-800" />
        </div>
      ) : (
        <VitalsTrendChart
          data={analytics?.daily_trends || []}
          days={activeFilter.days || 7}
          titleOverride={activeFilter.titleOverride}
          isSingleDay={activeFilter.mode === 'DAY'}
          mode={activeFilter.mode}
          selectedMetric={selectedMetric}
          selectedDate={activeFilter.selectedDate}
          startDate={activeFilter.startDate}
          endDate={activeFilter.endDate}
        />
      )}
    </div>
  );
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
    {[...appointments]
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      .map((apt) => {
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
            {apt.status === 'CANCELLED' && apt.cancellation_reason && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                Lý do hủy: {apt.cancellation_reason}
              </p>
            )}
          </div>
        );
      })}
  </TabListSection>
);

import React from 'react';
import { Users, AlertTriangle, CalendarCheck, Activity, ArrowUpRight } from 'lucide-react';

export interface DoctorKpiCardsProps {
  patientCount: number;
  warningCount: number;
  todayAppointmentsCount: number;
  upcomingCount: number;
  onlineCount: number;
  onNavigatePatients: () => void;
  onNavigateAppointments: () => void;
  loading?: boolean;
}

export const DoctorKpiCards: React.FC<DoctorKpiCardsProps> = ({
  patientCount,
  warningCount,
  todayAppointmentsCount,
  upcomingCount,
  onlineCount,
  onNavigatePatients,
  onNavigateAppointments,
  loading = false,
}) => {
  const kpis = [
    {
      label: 'Bệnh nhân phụ trách',
      value: String(patientCount).padStart(2, '0'),
      trend: '↑ 10%',
      trendClass: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      sub: 'Đã liên kết hồ sơ gia đình',
      icon: Users,
      iconCircle: 'bg-blue-50 text-blue-600 border border-blue-100',
      arrowBg: 'bg-blue-600 text-white hover:bg-blue-700',
      onClick: onNavigatePatients,
    },
    {
      label: 'Cần lưu ý sức khỏe',
      value: String(warningCount).padStart(2, '0'),
      trend: warningCount > 0 ? 'Cần theo dõi' : 'Ổn định',
      trendClass:
        warningCount > 0
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-emerald-50 text-emerald-600 border-emerald-200',
      sub: 'Nhịp tim hoặc SpO2 lệch ngưỡng',
      icon: AlertTriangle,
      iconCircle: 'bg-amber-50 text-amber-600 border border-amber-100',
      arrowBg: 'bg-amber-500 text-white hover:bg-amber-600',
      onClick: onNavigatePatients,
    },
    {
      label: 'Ca khám hôm nay',
      value: String(todayAppointmentsCount).padStart(2, '0'),
      trend: `${upcomingCount} sắp tới`,
      trendClass: 'bg-teal-50 text-teal-700 border-teal-200',
      sub: 'Đã lên lịch trong ngày',
      icon: CalendarCheck,
      iconCircle: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      arrowBg: 'bg-emerald-600 text-white hover:bg-emerald-700',
      onClick: onNavigateAppointments,
    },
    {
      label: 'Smartband kết nối',
      value: `${onlineCount}/${patientCount || 1}`,
      trend: 'Trực tuyến',
      trendClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      sub: 'Đang phát dữ liệu sinh hiệu',
      icon: Activity,
      iconCircle: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
      arrowBg: 'bg-indigo-600 text-white hover:bg-indigo-700',
      onClick: onNavigatePatients,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div
            key={kpi.label}
            onClick={kpi.onClick}
            className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className={`flex h-11 w-11 items-center justify-center rounded-full ${kpi.iconCircle}`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold ${kpi.trendClass}`}>
                {kpi.trend}
              </span>
            </div>

            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500">{kpi.label}</p>
                {loading && patientCount === 0 ? (
                  <div className="mt-1 h-8 w-16 rounded-lg bg-slate-200 animate-pulse" />
                ) : (
                  <p className="mt-1 text-3xl font-black tracking-tight text-slate-900">
                    {kpi.value}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-slate-400">{kpi.sub}</p>
              </div>

              <button
                type="button"
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${kpi.arrowBg}`}
                title="Xem chi tiết"
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

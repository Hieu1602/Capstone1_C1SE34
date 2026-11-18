import React from 'react';
import { Activity } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ActiveMetricsState,
  AREA_RENDER_ORDER,
  METRIC_CONFIGS,
  MetricKey,
  TelemetryPoint,
  TIME_RANGE_OPTIONS,
  TimeRange,
} from './telemetryUtils';

interface TelemetryChartCardProps {
  telemetryData: TelemetryPoint[];
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  activeMetrics: ActiveMetricsState;
  onToggleMetric: (key: MetricKey) => void;
  isDark: boolean;
}

const TIME_RANGE_SUBTITLES: Record<TimeRange, string> = {
  live: 'Theo dõi trực tiếp Nhịp tim, SpO2, Huyết áp, Nguy cơ ngã & Thân nhiệt theo từng phút',
  week: 'Chỉ số trung bình các chỉ số sinh hiệu theo từng ngày trong 7 ngày qua',
  month: 'Chỉ số trung bình các chỉ số sinh hiệu theo từng ngày trong 30 ngày qua',
};

const formatTooltipValue = (value: any, name: string, item: any) => {
  if (value === null || value === undefined) return ['Chưa có dữ liệu', name];
  if (name.includes('Nhịp tim')) return [`${value} bpm`, name];
  if (name.includes('SpO2')) return [`${value}%`, name];
  if (name.includes('Huyết áp')) return [`${value} mmHg`, name];
  if (name.includes('Thân nhiệt')) return [`${value} °C`, name];
  if (name.includes('Nguy cơ ngã')) {
    const fMax = item?.payload?.fallMax;
    const peakInfo = fMax && fMax > value ? ` (Đỉnh điểm sự cố: ${fMax} điểm)` : '';
    return [`${value} điểm${peakInfo}`, name];
  }
  return [value, name];
};

export const TelemetryChartCard: React.FC<TelemetryChartCardProps> = ({
  telemetryData,
  timeRange,
  onTimeRangeChange,
  activeMetrics,
  onToggleMetric,
  isDark,
}) => {
  const metricByKey = Object.fromEntries(METRIC_CONFIGS.map((m) => [m.key, m])) as Record<
    MetricKey,
    (typeof METRIC_CONFIGS)[number]
  >;

  return (
    <div className="lg:col-span-2 glass-card p-5 flex flex-col justify-between">
      <div>
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="font-heading font-bold text-[#16191F] dark:text-[#F1F4F9] text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#F05A24]" />
                Phân bố Rủi ro Y tế & Chỉ số Sinh hiệu Toàn diện
              </h3>
              <p className="text-xs text-[#68707E] dark:text-[#9AA1AF]">
                {TIME_RANGE_SUBTITLES[timeRange]}
              </p>
            </div>

            {/* Bộ chọn chu kỳ: Trực tiếp (Live) / Theo tuần / Theo tháng */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium border border-slate-200 dark:border-slate-700/60 self-start lg:self-auto">
              {TIME_RANGE_OPTIONS.map((opt) => {
                const isActive = timeRange === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => onTimeRangeChange(opt.key)}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      opt.isLive ? 'inline-flex items-center gap-1.5 ' : ''
                    }${
                      isActive
                        ? 'bg-white dark:bg-slate-700 text-[#F05A24] font-semibold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.isLive && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isActive ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                        }`}
                      />
                    )}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bộ lọc bật/tắt từng chỉ số sinh hiệu (Clickable Pills) */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">
              Chỉ số hiển thị:
            </span>
            {METRIC_CONFIGS.map((metric) => {
              const isOn = activeMetrics[metric.key];
              return (
                <button
                  key={metric.key}
                  type="button"
                  onClick={() => onToggleMetric(metric.key)}
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium border transition-all ${
                    isOn
                      ? metric.activeClass
                      : 'bg-transparent border-slate-200 dark:border-slate-700/60 text-slate-400 opacity-50 hover:opacity-80'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full mr-1.5 ${isOn ? metric.dotShadow : 'bg-slate-400'}`}
                    style={isOn ? { backgroundColor: metric.color } : undefined}
                  />
                  {metric.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-64 w-full">
          {telemetryData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetryData}>
                <defs>
                  {METRIC_CONFIGS.map((m) => (
                    <linearGradient key={m.gradientId} id={m.gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={m.color} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={m.color} stopOpacity={0.0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2E3442' : '#DCE1E8'} opacity={0.7} />
                <XAxis
                  dataKey="time"
                  stroke={isDark ? '#9AA1AF' : '#68707E'}
                  fontSize={11}
                  tickLine={false}
                  interval={timeRange === 'live' ? 1 : timeRange === 'week' ? 0 : 3}
                />
                <YAxis stroke={isDark ? '#9AA1AF' : '#68707E'} fontSize={11} domain={[0, 160]} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#1D222D' : '#FFFFFF',
                    borderColor: isDark ? '#323846' : '#DCE1E8',
                    borderRadius: '12px',
                    color: isDark ? '#F1F4F9' : '#16191F',
                    fontSize: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  }}
                  formatter={formatTooltipValue}
                />
                {AREA_RENDER_ORDER.map((key) => {
                  if (!activeMetrics[key]) return null;
                  const m = metricByKey[key];
                  return (
                    <Area
                      key={m.key}
                      type="monotone"
                      dataKey={m.key}
                      name={m.label}
                      stroke={m.color}
                      strokeWidth={m.strokeWidth}
                      dot={{ r: 3, strokeWidth: 1.5 }}
                      activeDot={{ r: 5 }}
                      connectNulls={true}
                      fillOpacity={1}
                      fill={`url(#${m.gradientId})`}
                    />
                  );
                })}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#DCE1E8] dark:border-[#323846] rounded-xl bg-gradient-to-b dark:from-white/[0.01] dark:to-transparent">
              <Activity className="w-8 h-8 text-[#F05A24]/70 mb-2" />
              <p className="text-xs font-semibold text-[#16191F] dark:text-[#F1F4F9]">
                Chưa có chuỗi dữ liệu sinh hiệu trong Database
              </p>
              <p className="text-[11px] text-[#68707E] dark:text-[#9AA1AF] mt-1 max-w-sm">
                Dữ liệu sẽ tự động hiển thị theo thời gian thực khi thiết bị Smartband hoặc Camera AI truyền telemetry.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

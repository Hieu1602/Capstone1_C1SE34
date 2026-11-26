// src/components/clinical/VitalsTrendChart.tsx
// Biểu đồ xu hướng sinh hiệu chuỗi thời gian (Recharts) cho Bác sĩ

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { TrendItem } from '../../types';
import { Activity, Heart, ShieldAlert, Thermometer, Droplets } from 'lucide-react';
import {
  VitalRangeMode,
  formatDM,
  formatDMY,
  formatShortWeekdayDM,
  parseFlexibleDate,
  parseYMD,
} from '../../utils/dateFilter';

export type VitalMetricKey = 'ALL' | 'HR' | 'SPO2' | 'BP' | 'TEMP';

interface VitalsTrendChartProps {
  data: TrendItem[];
  days?: number;
  titleOverride?: string;
  isSingleDay?: boolean;
  mode?: VitalRangeMode;
  selectedMetric?: VitalMetricKey;
  selectedDate?: string;
  startDate?: string;
  endDate?: string;
}

interface ChartPoint {
  date: string;
  fullDateTime: string;
  heartRate: number | null;
  spo2: number | null;
  bpSys: number | null;
  bpDia: number | null;
  temp: number | null;
}

function getMetricSafety(key: string, val: number): { label: string; cls: string } {
  if (key === 'heartRate') {
    if (val < 50 || val > 120) return { label: 'Nguy hiểm', cls: 'text-rose-400' };
    if (val < 60 || val > 100) return { label: 'Cần theo dõi', cls: 'text-amber-400' };
    return { label: 'Ổn định', cls: 'text-emerald-400' };
  }
  if (key === 'spo2') {
    if (val < 90) return { label: 'Nguy hiểm', cls: 'text-rose-400' };
    if (val < 95) return { label: 'Cần theo dõi', cls: 'text-amber-400' };
    return { label: 'Ổn định', cls: 'text-emerald-400' };
  }
  if (key === 'bpSys') {
    if (val >= 160 || val < 90) return { label: 'Nguy hiểm', cls: 'text-rose-400' };
    if (val >= 140) return { label: 'Cần theo dõi', cls: 'text-amber-400' };
    return { label: 'Ổn định', cls: 'text-emerald-400' };
  }
  if (key === 'temp') {
    if (val >= 38.5 || val < 35.0) return { label: 'Nguy hiểm', cls: 'text-rose-400' };
    if (val >= 37.5) return { label: 'Cần theo dõi', cls: 'text-amber-400' };
    return { label: 'Ổn định', cls: 'text-emerald-400' };
  }
  return { label: 'Bình thường', cls: 'text-slate-300' };
}

const CustomVitalTooltip: React.FC<{ active?: boolean; payload?: any[] }> = ({
  active,
  payload,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const row: ChartPoint | undefined = payload[0]?.payload;
  const headerTime = row?.fullDateTime || '';

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/95 px-3.5 py-2.5 text-xs text-slate-100 shadow-xl backdrop-blur-sm">
      <div className="mb-1.5 border-b border-slate-700/80 pb-1 font-bold text-blue-300">
        {headerTime}
      </div>
      <div className="space-y-1">
        {payload.map((entry: any) => {
          const val = entry.value;
          const dataKey = String(entry.dataKey || '');
          const unit =
            dataKey === 'heartRate'
              ? ' bpm'
              : dataKey === 'spo2'
                ? '%'
                : dataKey === 'temp'
                  ? '°C'
                  : ' mmHg';
          const safety =
            typeof val === 'number' ? getMetricSafety(dataKey, val) : null;
          return (
            <div key={dataKey} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}:
              </span>
              <span className="font-bold text-white">
                {val !== null && val !== undefined ? `${val}${unit}` : '--'}
                {safety && (
                  <span className={`ml-1.5 text-[10px] font-semibold ${safety.cls}`}>
                    ({safety.label})
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const VitalsTrendChart: React.FC<VitalsTrendChartProps> = ({
  data,
  days = 7,
  titleOverride,
  isSingleDay = false,
  mode,
  selectedMetric = 'ALL',
  selectedDate,
  startDate,
  endDate,
}) => {
  const effectiveMode: VitalRangeMode =
    mode || (isSingleDay || days === 1 ? 'DAY' : days > 10 ? 'MONTH' : 'WEEK');

  const getEmptyMessage = () => {
    if (effectiveMode === 'DAY' && selectedDate) {
      return `Chưa có dữ liệu sinh hiệu trong ngày ${formatDMY(parseYMD(selectedDate))}`;
    }
    if (effectiveMode === 'WEEK' && startDate && endDate) {
      return `Chưa có dữ liệu sinh hiệu trong tuần ${formatDMY(parseYMD(startDate))} – ${formatDMY(parseYMD(endDate))}`;
    }
    if (effectiveMode === 'MONTH' && selectedDate) {
      const d = parseYMD(selectedDate);
      return `Chưa có dữ liệu sinh hiệu trong Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
    }
    return 'Chưa có dữ liệu sinh hiệu trong khoảng thời gian đã chọn';
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-[#0F172A] p-6 text-center">
        <Activity className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
          {getEmptyMessage()}
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          Bác sĩ có thể bấm nút &lt; hoặc chọn ngày khác ở thanh lọc phía trên để tra cứu lịch sử.
        </p>
      </div>
    );
  }

  const defaultTitle =
    days === 1 ? 'Xu hướng Sinh hiệu Hôm nay' : `Xu hướng Sinh hiệu ${days} ngày gần nhất`;
  const title = titleOverride || defaultTitle;

  const isHourlyView = Boolean(
    effectiveMode === 'DAY' && data[0]?.hourly_records && data[0].hourly_records.length > 0
  );

  const parseBp = (bpStr?: string): { sys: number | null; dia: number | null } => {
    if (!bpStr || !bpStr.includes('/')) return { sys: null, dia: null };
    const [s, d] = bpStr.split('/').map((n) => Number(n.trim()));
    return {
      sys: !isNaN(s) && s > 0 ? s : null,
      dia: !isNaN(d) && d > 0 ? d : null,
    };
  };

  const referenceYear = (() => {
    const src = startDate || selectedDate;
    const m = src?.match(/^(\d{4})-/);
    return m ? Number(m[1]) : new Date().getFullYear();
  })();

  const chartData: ChartPoint[] =
    isHourlyView && data[0]?.hourly_records && data[0].hourly_records.length > 0
      ? data[0].hourly_records.map((h) => {
          const { sys, dia } = parseBp(h.bp);
          const dayDMY = selectedDate
            ? formatDMY(parseFlexibleDate(selectedDate, referenceYear))
            : data[0]?.date
              ? formatDMY(parseFlexibleDate(data[0].date, referenceYear))
              : '';
          return {
            date: h.time,
            fullDateTime: dayDMY ? `${h.time} • ${dayDMY}` : h.time,
            heartRate: h.heart_rate ?? null,
            spo2: h.spo2 ?? null,
            bpSys: sys,
            bpDia: dia,
            temp: h.skin_temp !== undefined ? Math.round(h.skin_temp * 10) / 10 : null,
          };
        })
      : data.map((item) => {
          const d = parseFlexibleDate(item.date, referenceYear);
          const dateLabel =
            effectiveMode === 'WEEK'
              ? formatShortWeekdayDM(item.date, referenceYear)
              : formatDM(d);
          const fullDateTime =
            effectiveMode === 'WEEK'
              ? `${formatShortWeekdayDM(item.date, referenceYear)} • ${formatDMY(d)}`
              : `Ngày ${formatDMY(d)}`;
          return {
            date: dateLabel,
            fullDateTime,
            heartRate: item.avg_heart_rate ? Math.round(item.avg_heart_rate) : null,
            spo2: item.avg_spo2 ? Math.round(item.avg_spo2 * 10) / 10 : null,
            bpSys: null,
            bpDia: null,
            temp: item.avg_skin_temp ? Math.round(item.avg_skin_temp * 10) / 10 : null,
          };
        });

  const showHR = selectedMetric === 'ALL' || selectedMetric === 'HR';
  const showSpO2 = selectedMetric === 'ALL' || selectedMetric === 'SPO2';
  const showBP = selectedMetric === 'BP';
  const showTemp = selectedMetric === 'TEMP';

  const hasBPPoints = chartData.some((p) => p.bpSys !== null);
  const hasTempPoints = chartData.some((p) => p.temp !== null);

  if ((showBP && !hasBPPoints) || (showTemp && !hasTempPoints)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-[#0F172A] p-6 text-center">
        {showBP ? (
          <Droplets className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
        ) : (
          <Thermometer className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
        )}
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
          Chưa có dữ liệu {showBP ? 'Huyết áp' : 'Nhiệt độ'} trong khoảng thời gian đã chọn
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          Vui lòng chọn chỉ số khác hoặc chuyển sang mốc thời gian có dữ liệu đo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header chỉ số */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            {title}
          </h4>
        </div>

        {/* Legend chú thích màu */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {showHR && (
            <div className="flex items-center space-x-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
              <span className="text-slate-600 dark:text-slate-300 font-medium">Nhịp tim (BPM)</span>
            </div>
          )}
          {showSpO2 && (
            <div className="flex items-center space-x-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-600 dark:text-slate-300 font-medium">Nồng độ SpO₂ (%)</span>
            </div>
          )}
          {showBP && (
            <>
              <div className="flex items-center space-x-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">Tâm thu (mmHg)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">Tâm trương (mmHg)</span>
              </div>
            </>
          )}
          {showTemp && (
            <div className="flex items-center space-x-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
              <span className="text-slate-600 dark:text-slate-300 font-medium">Nhiệt độ (°C)</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart container */}
      <div className="h-72 w-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-[#0F172A]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#475569' }}
              interval={effectiveMode === 'MONTH' ? Math.max(0, Math.floor(chartData.length / 7)) : isHourlyView ? 'preserveStartEnd' : 0}
            />
            {showHR && (
              <YAxis
                yAxisId="left"
                width={54}
                domain={[50, 130]}
                stroke="#3B82F6"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                unit=" bpm"
              />
            )}
            {showSpO2 && (
              <YAxis
                yAxisId="right"
                width={44}
                orientation={showHR ? 'right' : 'left'}
                domain={[85, 100]}
                stroke="#10B981"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                unit="%"
              />
            )}
            {showBP && (
              <YAxis
                yAxisId="bp"
                width={62}
                domain={[50, 180]}
                stroke="#F43F5E"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                unit=" mmHg"
              />
            )}
            {showTemp && (
              <YAxis
                yAxisId="temp"
                width={44}
                domain={[34, 40]}
                stroke="#F97316"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                unit="°C"
              />
            )}
            <Tooltip content={<CustomVitalTooltip />} />
            {showHR && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="heartRate"
                name="Nhịp tim"
                stroke="#3B82F6"
                strokeWidth={2.5}
                connectNulls
                dot={{ r: isHourlyView ? 2.5 : 3.5, fill: '#3B82F6', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            )}
            {showSpO2 && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="spo2"
                name="SpO₂"
                stroke="#10B981"
                strokeWidth={2.5}
                connectNulls
                dot={{ r: isHourlyView ? 2.5 : 3.5, fill: '#10B981', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            )}
            {showBP && (
              <>
                <Line
                  yAxisId="bp"
                  type="monotone"
                  dataKey="bpSys"
                  name="Huyết áp tâm thu"
                  stroke="#F43F5E"
                  strokeWidth={2.5}
                  connectNulls
                  dot={{ r: 3.5, fill: '#F43F5E', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  yAxisId="bp"
                  type="monotone"
                  dataKey="bpDia"
                  name="Huyết áp tâm trương"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  connectNulls
                  dot={{ r: 3, fill: '#F59E0B', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </>
            )}
            {showTemp && (
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temp"
                name="Nhiệt độ da"
                stroke="#F97316"
                strokeWidth={2.5}
                connectNulls
                dot={{ r: 3.5, fill: '#F97316', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Dải chỉ dẫn lâm sàng */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="flex items-center space-x-2.5 rounded-xl border border-blue-100 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/30 p-2.5">
          <Heart className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            <strong className="text-slate-800 dark:text-white">Ngưỡng nhịp tim chuẩn:</strong> 60 - 100 bpm lúc nghỉ ngơi.
          </p>
        </div>
        <div className="flex items-center space-x-2.5 rounded-xl border border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30 p-2.5">
          <ShieldAlert className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            <strong className="text-slate-800 dark:text-white">Ngưỡng SpO₂ an toàn:</strong> Trên 95% là bình thường. Dưới 90% cần xử trí khẩn.
          </p>
        </div>
      </div>
    </div>
  );
};


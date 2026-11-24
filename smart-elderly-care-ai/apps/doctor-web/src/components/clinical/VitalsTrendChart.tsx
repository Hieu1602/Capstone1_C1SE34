// src/components/clinical/VitalsTrendChart.tsx
// Biểu đồ xu hướng sinh hiệu chuỗi thời gian (Recharts) cho Bác sĩ

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
} from 'recharts';
import { TrendItem } from '../../types';
import { Activity, Heart, ShieldAlert, MousePointerClick } from 'lucide-react';

interface VitalsTrendChartProps {
  data: TrendItem[];
  days?: number;
  titleOverride?: string;
  title?: string;
  isSingleDay?: boolean;
  onSelectDate?: (dateStr: string) => void;
}

export const VitalsTrendChart: React.FC<VitalsTrendChartProps> = ({
  data,
  days = 7,
  titleOverride,
  title,
  isSingleDay = false,
  onSelectDate,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-[#0F172A] p-6 text-center">
        <Activity className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Chưa có dữ liệu sinh hiệu chuỗi thời gian</p>
        <p className="text-[11px] text-slate-400">Dữ liệu sẽ được tự động vẽ khi vòng đeo tay Smartband đồng bộ.</p>
      </div>
    );
  }

  const defaultTitle =
    days === 1 ? 'Xu hướng Sinh hiệu Hôm nay' : `Xu hướng Sinh hiệu ${days} ngày gần nhất`;
  const chartTitle = title || titleOverride || defaultTitle;

  const isHourlyView = Boolean(
    isSingleDay || (data.length === 1 && data[0]?.hourly_records && data[0].hourly_records.length > 0)
  );

  // Định dạng dữ liệu hiển thị (theo mốc giờ nếu xem 1 ngày, theo từng ngày nếu xem tuần/tháng)
  const chartData = useMemo(() => {
    if (isHourlyView && data[0]?.hourly_records && data[0].hourly_records.length > 0) {
      return data[0].hourly_records.map((h) => ({
        date: h.time,
        heartRate: h.heart_rate ?? null,
        spo2: h.spo2 ?? null,
        minSpo2: h.spo2 ?? null,
      }));
    }

    // Chế độ nhiều ngày (mặc định 7 ngày hoặc 30 ngày):
    // Tạo đầy đủ các ngày liên tiếp theo lịch để không bị co rút thành 2 đầu
    const totalDays = Math.max(1, days || 7);
    const result: any[] = [];
    const now = new Date();

    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const ymd = `${d.getFullYear()}-${mm}-${dd}`;
      const dateLabel = `${dd}/${mm}`;

      const match = data.find((item) => {
        if (!item || !item.date) return false;
        if (item.date === ymd || item.date === dateLabel) return true;
        if (item.date.startsWith(ymd)) return true;
        const parts = item.date.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            return parts[0] === String(d.getFullYear()) && parts[1].padStart(2, '0') === mm && parts[2].padStart(2, '0') === dd;
          }
          return parts[0].padStart(2, '0') === dd && parts[1].padStart(2, '0') === mm;
        }
        return false;
      });

      result.push({
        date: dateLabel,
        fullDate: ymd,
        heartRate: match && match.avg_heart_rate ? Math.round(match.avg_heart_rate) : null,
        spo2: match && match.avg_spo2 ? Math.round(match.avg_spo2 * 10) / 10 : null,
        minSpo2: match && match.min_spo2 ? Math.round(match.min_spo2 * 10) / 10 : null,
      });
    }

    return result;
  }, [data, isHourlyView, days]);

  // Thống kê cực trị Hero KPI Bar
  const kpiStats = useMemo(() => {
    const validHRs = chartData
      .map((d) => d.heartRate)
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));
    const validSpO2s = chartData
      .map((d) => d.spo2)
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));

    const avgHR =
      validHRs.length > 0 ? Math.round(validHRs.reduce((a, b) => a + b, 0) / validHRs.length) : null;
    const minHR = validHRs.length > 0 ? Math.min(...validHRs) : null;
    const maxHR = validHRs.length > 0 ? Math.max(...validHRs) : null;

    const avgSpO2 =
      validSpO2s.length > 0
        ? Math.round((validSpO2s.reduce((a, b) => a + b, 0) / validSpO2s.length) * 10) / 10
        : null;
    const minSpO2 = validSpO2s.length > 0 ? Math.min(...validSpO2s) : null;

    return { avgHR, minHR, maxHR, avgSpO2, minSpO2 };
  }, [chartData]);

  return (
    <div className="space-y-4">
      {/* 1. Dải tóm tắt chỉ số cực trị Hero KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 dark:border-blue-950 dark:bg-blue-950/20 p-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
            Nhịp tim Trung bình
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-extrabold text-slate-900 dark:text-white">
              {kpiStats.avgHR ? `${kpiStats.avgHR}` : '--'}
            </span>
            <span className="text-[10px] font-semibold text-slate-500">bpm</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/60 p-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            Dao động Nhịp tim
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
              {kpiStats.minHR && kpiStats.maxHR ? `${kpiStats.minHR} - ${kpiStats.maxHR}` : '--'}
            </span>
            <span className="text-[10px] font-semibold text-slate-500">bpm</span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 dark:border-emerald-950 dark:bg-emerald-950/20 p-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
            SpO₂ Trung bình
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-extrabold text-slate-900 dark:text-white">
              {kpiStats.avgSpO2 ? `${kpiStats.avgSpO2}` : '--'}
            </span>
            <span className="text-[10px] font-semibold text-slate-500">%</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/60 p-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            SpO₂ Thấp nhất
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
              {kpiStats.minSpO2 ? `${kpiStats.minSpO2}` : '--'}
            </span>
            <span className="text-[10px] font-semibold text-slate-500">%</span>
          </div>
        </div>
      </div>

      {/* 2. Header biểu đồ & Chú thích */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            {chartTitle}
          </h4>
          {!isHourlyView && onSelectDate && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
              <MousePointerClick className="h-3 w-3" />
              <span>Bấm vào ngày để xem chi tiết 24h</span>
            </span>
          )}
        </div>

        {/* Legend chú thích màu */}
        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
            <span className="text-slate-600 dark:text-slate-300 font-medium">Nhịp tim (BPM)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-600 dark:text-slate-300 font-medium">Nồng độ SpO2 (%)</span>
          </div>
        </div>
      </div>

      {/* 3. Khung vẽ biểu đồ Recharts */}
      <div className="h-72 w-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-[#0F172A]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 25, left: 15, bottom: 6 }}
            onClick={(e: any) => {
              if (!isHourlyView && onSelectDate && e && e.activePayload && e.activePayload.length > 0) {
                const payload = e.activePayload[0].payload;
                if (payload && (payload.fullDate || payload.date)) {
                  onSelectDate(payload.fullDate || payload.date);
                }
              }
            }}
          >
            {/* Dải tham chiếu an toàn y tế mờ */}
            <ReferenceArea yAxisId="left" y1={60} y2={100} fill="#3B82F6" fillOpacity={0.05} />
            <ReferenceArea yAxisId="right" y1={95} y2={100} fill="#10B981" fillOpacity={0.05} />

            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#475569' }}
              interval={isHourlyView ? 2 : 0}
              dy={4}
            />
            {/* Trục trái: Nhịp tim (50 - 130) với ticks chuẩn y tế */}
            <YAxis
              yAxisId="left"
              width={68}
              domain={[50, 130]}
              ticks={[50, 70, 90, 110, 130]}
              stroke="#3B82F6"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              unit=" bpm"
            />
            {/* Trục phải: SpO2 (85 - 100) với ticks chuẩn y tế */}
            <YAxis
              yAxisId="right"
              width={48}
              orientation="right"
              domain={[85, 100]}
              ticks={[85, 90, 95, 100]}
              stroke="#10B981"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              unit="%"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E293B',
                borderRadius: '12px',
                border: '1px solid #334155',
                color: '#F8FAFC',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                fontSize: '12px',
              }}
              formatter={(value: any, name: string) => {
                if (value === null || value === undefined) return ['Chưa có dữ liệu', name];
                if (name.includes('Nhịp tim')) return [`${value} bpm`, name];
                if (name.includes('SpO2')) return [`${value}%`, name];
                return [value, name];
              }}
              labelFormatter={(label: string) =>
                isHourlyView
                  ? `Khung giờ: ${label}`
                  : `Ngày: ${label}${!isHourlyView && onSelectDate ? ' (Bấm để xem chi tiết 24h)' : ''}`
              }
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="heartRate"
              name="Nhịp tim trung bình"
              stroke="#3B82F6"
              strokeWidth={2.5}
              connectNulls={true}
              dot={{ r: isHourlyView ? 2.5 : 3.5, fill: '#3B82F6', strokeWidth: 1, stroke: '#FFFFFF' }}
              activeDot={{ r: 5.5, stroke: '#FFFFFF', strokeWidth: 2 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="spo2"
              name="SpO2 trung bình"
              stroke="#10B981"
              strokeWidth={2.5}
              connectNulls={true}
              dot={{ r: isHourlyView ? 2.5 : 3.5, fill: '#10B981', strokeWidth: 1, stroke: '#FFFFFF' }}
              activeDot={{ r: 5.5, stroke: '#FFFFFF', strokeWidth: 2 }}
            />
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
            <strong className="text-slate-800 dark:text-white">Ngưỡng SpO2 an toàn:</strong> Trên 95% là bình thường. Dưới 90% cần xử trí khẩn.
          </p>
        </div>
      </div>
    </div>
  );
};


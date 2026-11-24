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
  Legend,
} from 'recharts';
import { TrendItem } from '../../types';
import { Activity, Heart, ShieldAlert } from 'lucide-react';

interface VitalsTrendChartProps {
  data: TrendItem[];
  days?: number;
  titleOverride?: string;
  isSingleDay?: boolean;
}

export const VitalsTrendChart: React.FC<VitalsTrendChartProps> = ({
  data,
  days = 7,
  titleOverride,
  isSingleDay = false,
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
  const title = titleOverride || defaultTitle;

  const isHourlyView = Boolean(
    isSingleDay || (data.length === 1 && data[0]?.hourly_records && data[0].hourly_records.length > 0)
  );

  // Định dạng dữ liệu hiển thị (theo mốc giờ nếu xem 1 ngày, theo ngày nếu xem tuần/tháng)
  const chartData =
    isHourlyView && data[0]?.hourly_records && data[0].hourly_records.length > 0
      ? data[0].hourly_records.map((h) => ({
          date: h.time,
          heartRate: h.heart_rate ?? null,
          spo2: h.spo2 ?? null,
          minSpo2: h.spo2 ?? null,
        }))
      : data.map((item) => {
          let dateLabel = item.date;
          try {
            const parts = item.date.split('-');
            if (parts.length === 3) {
              dateLabel = `${parts[2]}/${parts[1]}`;
            }
          } catch {
            // fallback
          }

          return {
            date: dateLabel,
            heartRate: item.avg_heart_rate ? Math.round(item.avg_heart_rate) : null,
            spo2: item.avg_spo2 ? Math.round(item.avg_spo2 * 10) / 10 : null,
            minSpo2: item.min_spo2 ? Math.round(item.min_spo2 * 10) / 10 : null,
          };
        });

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

      {/* Chart container */}
      <div className="h-72 w-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-[#0F172A]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#475569' }}
              interval={isHourlyView ? 1 : 0}
            />
            {/* Trục trái: Nhịp tim (40 - 140) */}
            <YAxis
              yAxisId="left"
              domain={[50, 130]}
              stroke="#3B82F6"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              unit=" bpm"
            />
            {/* Trục phải: SpO2 (80 - 100) */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[85, 100]}
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
                isHourlyView ? `Khung giờ: ${label}` : `Ngày: ${label}`
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
              dot={{ r: isHourlyView ? 2 : 3, fill: '#3B82F6', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="spo2"
              name="SpO2 trung bình"
              stroke="#10B981"
              strokeWidth={2.5}
              connectNulls={true}
              dot={{ r: isHourlyView ? 2 : 3, fill: '#10B981', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
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


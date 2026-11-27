// src/components/dashboard/DoctorAlertsAreaChart.tsx
// Biểu đồ Đường cong đổ bóng mượt (Smooth Multi-Series Area Chart) phân loại Cảnh báo Y tế & Sự cố
// Phong cách SaaS Y tế hiện đại (Linear / Stripe): Gradient fill, ẩn trục Y, chú thích tương tác bật/tắt

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { ChevronLeft, ChevronRight, Calendar, ChevronDown } from 'lucide-react';
import { MonthYearPopover } from './MonthYearPopover';

export interface AlertDayStat {
  label: string;
  fullLabel: string;
  fall: number;
  heart_alert: number;
  spo2_alert: number;
  sos_alert: number;
  total: number;
}

interface DoctorAlertsAreaChartProps {
  data: AlertDayStat[];
  range: '7D' | '30D';
  onRangeChange: (r: '7D' | '30D') => void;
  periodLabel?: string;
  onPrev?: () => void;
  onNext?: () => void;
  isNextDisabled?: boolean;
  onResetCurrent?: () => void;
  isCurrentPeriod?: boolean;
  selectedMonthStr?: string;
  onMonthSelect?: (monthStr: string) => void;
}

type SeriesKey = 'fall' | 'heart' | 'spo2' | 'sos';

interface SeriesConfig {
  key: SeriesKey;
  dataKey: keyof AlertDayStat;
  label: string;
  color: string;
  gradId: string;
}

const SERIES_CONFIG: SeriesConfig[] = [
  { key: 'fall', dataKey: 'fall', label: 'Té ngã AI', color: '#F43F5E', gradId: 'gradFall' },
  { key: 'heart', dataKey: 'heart_alert', label: 'Nhịp tim bất thường', color: '#2563EB', gradId: 'gradHeart' },
  { key: 'spo2', dataKey: 'spo2_alert', label: 'SpO2 hạ thấp', color: '#F59E0B', gradId: 'gradSpo2' },
  { key: 'sos', dataKey: 'sos_alert', label: 'Nút SOS khẩn cấp', color: '#8B5CF6', gradId: 'gradSos' },
];

const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload as AlertDayStat;
  const fall = data?.fall ?? 0;
  const heart = data?.heart_alert ?? 0;
  const spo2 = data?.spo2_alert ?? 0;
  const sos = data?.sos_alert ?? 0;
  const total = data?.total ?? (fall + heart + spo2 + sos);

  return (
    <div className="rounded-xl border border-slate-100 bg-white/95 p-3 shadow-lg backdrop-blur-sm min-w-[210px] text-xs space-y-2 dark:border-slate-800/80 dark:bg-[#0F172A]/95">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
        <span className="font-bold text-slate-800 dark:text-slate-100">{data?.fullLabel || label}</span>
        <span className="text-[10px] text-slate-400 font-medium">Báo cáo lâm sàng</span>
      </div>

      <div className="space-y-1.5 font-medium">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full bg-[#F43F5E]" />
            Té ngã AI:
          </span>
          <span className="font-bold text-slate-900 dark:text-white">{fall}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
            Nhịp tim bất thường:
          </span>
          <span className="font-bold text-slate-900 dark:text-white">{heart}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
            SpO2 hạ thấp:
          </span>
          <span className="font-bold text-slate-900 dark:text-white">{spo2}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full bg-[#8B5CF6]" />
            Nút SOS khẩn cấp:
          </span>
          <span className="font-bold text-slate-900 dark:text-white">{sos}</span>
        </div>
      </div>

      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="font-bold text-slate-700 dark:text-slate-300">Tổng cảnh báo:</span>
        <span className="font-extrabold text-blue-600 text-sm dark:text-blue-400">{total}</span>
      </div>
    </div>
  );
};

export const DoctorAlertsAreaChart: React.FC<DoctorAlertsAreaChartProps> = ({
  data,
  range,
  onRangeChange,
  periodLabel,
  onPrev,
  onNext,
  isNextDisabled = false,
  onResetCurrent,
  isCurrentPeriod = true,
  selectedMonthStr,
  onMonthSelect,
}) => {
  const [showPickerPopover, setShowPickerPopover] = useState(false);
  const [visibleSeries, setVisibleSeries] = useState<Record<SeriesKey, boolean>>({
    fall: true,
    heart: true,
    spo2: true,
    sos: true,
  });

  const parsedAnchor = (() => {
    if (selectedMonthStr) {
      const [y, m] = selectedMonthStr.split('-').map(Number);
      if (y && m) return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  })();

  const toggleSeries = (key: SeriesKey) => {
    setVisibleSeries((prev) => {
      const activeCount = Object.values(prev).filter(Boolean).length;
      // Tránh tắt hết toàn bộ 4 đường cùng lúc
      if (activeCount === 1 && prev[key]) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  };

  const isFallZero = data.every((d) => (d.fall ?? 0) === 0);
  const isHeartZero = data.every((d) => (d.heart_alert ?? 0) === 0);
  const isSpo2Zero = data.every((d) => (d.spo2_alert ?? 0) === 0);
  const isSosZero = data.every((d) => (d.sos_alert ?? 0) === 0);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between dark:border-slate-800/80 dark:bg-[#131C31]">
      {/* 1. Header & Segmented Control */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-heading text-base font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
              Phân loại Cảnh báo Y tế &amp; Sự cố
            </h3>
            <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 animate-pulse dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
              Thời gian thực
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed dark:text-slate-400">
            Thống kê Té ngã AI, Nhịp tim bất thường, SpO2 hạ thấp &amp; Nút SOS khẩn cấp theo từng ngày
          </p>
        </div>

        {/* Bộ chuyển đổi khoảng thời gian & Điều hướng Tuần/Tháng */}
        <div className="flex flex-wrap items-center justify-end gap-1.5 self-start shrink-0">
          {/* Segmented Control - Nút cố định kích thước */}
          <div className="inline-flex rounded-xl border border-slate-200/90 bg-slate-100/80 p-0.5 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800/80">
            {(['7D', '30D'] as const).map((r) => {
              const isActive = range === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRangeChange(r)}
                  className={`px-2.5 rounded-lg py-1 text-xs font-bold transition-all text-center whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-white text-blue-600 shadow-2xs dark:bg-slate-900 dark:text-blue-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {r === '7D' ? 'Theo tuần' : 'Theo tháng'}
                </button>
              );
            })}
          </div>

          {/* Navigator: Cụm nút [<][>] cố định + Ô ngày cố định width + Nút reset cố định vị trí */}
          <div className="inline-flex items-center gap-1.5">
            {/* Cụm 2 nút lùi/tiến ghép đôi cố định vị trí - Bấm liên tiếp không bị nhảy nút */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800 shadow-2xs">
              <button
                type="button"
                onClick={onPrev}
                className="flex h-6 w-6 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
                title={range === '7D' ? 'Tuần trước' : 'Tháng trước'}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={isNextDisabled}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
                  isNextDisabled
                    ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer'
                }`}
                title={range === '7D' ? 'Tuần tiếp theo' : 'Tháng tiếp theo'}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Ô hiển thị nhãn thời gian - Nút mở Popover chọn nhanh Tháng/Năm */}
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => setShowPickerPopover((v) => !v)}
                className="relative flex min-w-[136px] h-7 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs hover:border-blue-400 hover:bg-blue-50/40 dark:hover:border-blue-500 transition cursor-pointer"
                title="Bấm để chọn nhanh Tháng / Năm"
              >
                <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="truncate">{periodLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              </button>

              <MonthYearPopover
                isOpen={showPickerPopover}
                onClose={() => setShowPickerPopover(false)}
                selectedYear={parsedAnchor.year}
                selectedMonth={parsedAnchor.month}
                onSelectMonthYear={(year, month) => {
                  const mm = String(month + 1).padStart(2, '0');
                  onMonthSelect?.(`${year}-${mm}`);
                }}
                onSelectCurrent={() => onResetCurrent?.()}
                currentLabel="Tháng hiện tại"
                disableFuture={true}
                align="right"
              />
            </div>

            {/* Nút quay về hiện tại */}
            {!isCurrentPeriod && (
              <button
                type="button"
                onClick={onResetCurrent}
                className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-600 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-900 transition cursor-pointer shrink-0 whitespace-nowrap"
                title="Quay lại thời điểm hiện tại"
              >
                {range === '7D' ? 'Tuần này' : 'Tháng này'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Interactive Legend: Bật/tắt các đường cảnh báo */}
      <div className="flex flex-wrap items-center gap-1.5 pb-2 pt-1 border-t border-slate-100/90 dark:border-slate-800/80 mb-2">
        {SERIES_CONFIG.map((s) => {
          const isVisible = visibleSeries[s.key];
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleSeries(s.key)}
              title={isVisible ? `Ẩn ${s.label}` : `Hiện ${s.label}`}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isVisible
                  ? 'bg-slate-50 text-slate-700 border border-slate-200/80 shadow-2xs hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                  : 'bg-transparent text-slate-400 border border-transparent line-through hover:text-slate-600 dark:text-slate-500'
              }`}
            >
              <span
                className="h-2 w-2 rounded-full transition-transform"
                style={{ backgroundColor: isVisible ? s.color : '#94A3B8' }}
              />
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Smooth Area Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="gradFall" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="gradHeart" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.32} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradSpo2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="gradSos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            {/* Lưới ngang siêu mảnh, không có lưới dọc */}
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />

            <XAxis
              dataKey="label"
              padding={{ left: 16, right: 16 }}
              tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              dy={4}
            />

            {/* Hiển thị nhãn số nguyên trên trục tung Y thẳng hàng với lưới ngang */}
            <YAxis
              hide={false}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 500 }}
              domain={[0, (dataMax: number) => Math.ceil((dataMax + 3) / 4) * 4]}
              width={40}
            />

            <Tooltip
              content={<CustomAreaTooltip />}
              cursor={{ stroke: '#94A3B8', strokeWidth: 1, strokeDasharray: '3 3' }}
              allowEscapeViewBox={{ x: false, y: false }}
              offset={14}
              wrapperStyle={{ zIndex: 30, pointerEvents: 'none' }}
            />

            {visibleSeries.fall && (
              <Area
                type="monotone"
                dataKey="fall"
                name="Té ngã AI"
                stroke="#F43F5E"
                strokeWidth={isFallZero ? 1.75 : 2.5}
                strokeDasharray={isFallZero ? '4 4' : undefined}
                strokeOpacity={isFallZero ? 0.65 : 1}
                fill="url(#gradFall)"
                dot={isFallZero ? false : { r: 3, fill: '#F43F5E', stroke: '#fff', strokeWidth: 1.5 }}
                activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
              />
            )}

            {visibleSeries.heart && (
              <Area
                type="monotone"
                dataKey="heart_alert"
                name="Nhịp tim bất thường"
                stroke="#2563EB"
                strokeWidth={isHeartZero ? 1.75 : 2.5}
                strokeDasharray={isHeartZero ? '4 4' : undefined}
                strokeOpacity={isHeartZero ? 0.65 : 1}
                fill="url(#gradHeart)"
                dot={isHeartZero ? false : { r: 3, fill: '#2563EB', stroke: '#fff', strokeWidth: 1.5 }}
                activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
              />
            )}

            {visibleSeries.spo2 && (
              <Area
                type="monotone"
                dataKey="spo2_alert"
                name="SpO2 hạ thấp"
                stroke="#F59E0B"
                strokeWidth={isSpo2Zero ? 1.75 : 2.5}
                strokeDasharray={isSpo2Zero ? '4 4' : undefined}
                strokeOpacity={isSpo2Zero ? 0.65 : 1}
                fill="url(#gradSpo2)"
                dot={isSpo2Zero ? false : { r: 3, fill: '#F59E0B', stroke: '#fff', strokeWidth: 1.5 }}
                activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
              />
            )}

            {visibleSeries.sos && (
              <Area
                type="monotone"
                dataKey="sos_alert"
                name="Nút SOS khẩn cấp"
                stroke="#8B5CF6"
                strokeWidth={isSosZero ? 1.75 : 2.5}
                strokeDasharray={isSosZero ? '4 4' : undefined}
                strokeOpacity={isSosZero ? 0.65 : 1}
                fill="url(#gradSos)"
                dot={isSosZero ? false : { r: 3, fill: '#8B5CF6', stroke: '#fff', strokeWidth: 1.5 }}
                activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

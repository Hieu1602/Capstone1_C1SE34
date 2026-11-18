import React from 'react';
import {
  Video,
  BatteryCharging,
  RotateCw,
  SlidersHorizontal,
  Heart,
  Droplets,
  Zap,
  EyeOff,
  Clock,
} from 'lucide-react';
import { Device } from '../../types';
import { DEVICE_TYPE_META } from './deviceMeta';

interface DeviceCardProps {
  device: Device;
  isRebooting: boolean;
  onReboot: (device: Device) => void;
  onOpenConfig: (device: Device) => void;
}

const EDGE_HUB_STATS = [
  { label: 'SoC:', value: 'RK3588 (Orange Pi 5)', color: 'text-slate-800 dark:text-white' },
  { label: 'Tải NPU:', value: '38% (6.0 TOPS)', color: 'text-sky-600 dark:text-sky-400' },
  { label: 'Nhiệt độ:', value: '48°C (Active Fan)', color: 'text-slate-800 dark:text-white' },
  { label: 'Broker:', value: 'EMQX :1883', color: 'text-indigo-600 dark:text-indigo-400' },
];

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  isRebooting,
  onReboot,
  onOpenConfig,
}) => {
  const meta = DEVICE_TYPE_META[device.device_type] || DEVICE_TYPE_META.SENSOR;
  const DeviceIcon = meta.icon;
  const isCam = device.device_type === 'CAMERA';
  const isBand = device.device_type === 'SMARTBAND';
  const isHub = device.device_type === 'EDGE_HUB';

  const smartbandMetrics = [
    {
      icon: Heart,
      iconColor: 'text-rose-500',
      text: `HR: ${device.config?.hr_threshold_low || 50}-${device.config?.hr_threshold_high || 120}`,
    },
    {
      icon: Droplets,
      iconColor: 'text-sky-500',
      text: `SpO2: <${device.config?.spo2_threshold_low || 90}%`,
    },
    {
      icon: Zap,
      iconColor: 'text-amber-500',
      text: `Va đập: >${device.config?.fall_impact_threshold || 2.5}g`,
    },
    {
      icon: Clock,
      iconColor: 'text-indigo-500',
      text: `Bất động: >${device.config?.immobility_seconds || 10}s`,
    },
  ];

  return (
    <div className="glass-card overflow-hidden flex flex-col justify-between hover:border-sky-400 dark:hover:border-[#FF6B35]/40 transition-all duration-200">
      {/* Card Header */}
      <div className="p-5 pb-4 border-b border-slate-100 dark:border-[#454A53]">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${meta.style}`}>
              <DeviceIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="font-heading font-bold text-sm text-slate-900 dark:text-[#F5F6F8]">
                {device.name}
              </span>
              <p className="text-[11px] font-mono text-slate-500 dark:text-[#A1A7B1] mt-0.5">
                {device.device_id} • {device.location || 'Toàn nhà'}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              device.is_online ? 'badge-live' : 'badge-danger'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                device.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span>{device.is_online ? 'Trực tuyến' : 'Ngoại tuyến'}</span>
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 mt-3 font-medium">
          {device.status_text}
        </p>
      </div>

      {/* Card Body Details */}
      <div className="p-5 py-4 space-y-3 bg-slate-50/60 dark:bg-[#101216]/60 flex-1">
        {/* Smartband Vitals Info */}
        {isBand && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                <BatteryCharging className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Dung lượng pin:</span>
              </span>
              <span className="font-bold text-sky-600 dark:text-sky-400">
                {device.battery_level}% (Đang ổn định)
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-[#202329] border border-sky-100 dark:border-[#454A53] space-y-2 font-mono shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Ngưỡng cảnh báo y tế đang kích hoạt:
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {smartbandMetrics.map((m, idx) => {
                  const MetricIcon = m.icon;
                  return (
                    <div key={idx} className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300">
                      <MetricIcon className={`w-3.5 h-3.5 ${m.iconColor} shrink-0`} />
                      <span>{m.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Camera AI Stream Preview */}
        {isCam && (
          <div className="space-y-2.5">
            <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden border border-slate-200 dark:border-[#454A53] flex items-center justify-center group shadow-xs">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 z-10" />
              {device.config?.is_sleep ? (
                <div className="z-20 text-center">
                  <EyeOff className="w-8 h-8 text-amber-400 mx-auto mb-1 opacity-80" />
                  <span className="text-xs font-semibold text-white">Chế độ riêng tư (Tắt ghi hình)</span>
                </div>
              ) : (
                <div className="z-20 text-center">
                  <Video className="w-8 h-8 text-sky-400 mx-auto mb-1 animate-pulse" />
                  <span className="text-[11px] font-mono font-medium text-sky-400 flex items-center justify-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                    <span>LIVE RTSP • 30 FPS</span>
                  </span>
                </div>
              )}
              <div className="absolute top-2 left-2 z-20 flex items-center space-x-1 px-2 py-0.5 rounded bg-black/60 text-[10px] font-mono text-white">
                <span>{device.config?.resolution || '2K Super HD'}</span>
              </div>
              <div className="absolute bottom-2 left-2 z-20 text-[10px] text-white/90 font-medium">
                Phòng khách • Góc quan sát 135°
              </div>
            </div>

            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-slate-500 dark:text-slate-400">Bảo vệ AI Pose:</span>
              <span className="font-bold text-sky-600 dark:text-sky-400 font-mono">
                {device.config?.is_ai_protect ? 'Đang bật (YOLOv8-Pose)' : 'Đã tắt'}
              </span>
            </div>
          </div>
        )}

        {/* Edge Hub Telemetry */}
        {isHub && (
          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-white dark:bg-[#202329] border border-sky-100 dark:border-[#454A53] space-y-2 font-mono text-xs shadow-xs">
              {EDGE_HUB_STATS.map((hubStat, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{hubStat.label}</span>
                  <span className={`font-bold ${hubStat.color}`}>{hubStat.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center justify-between pt-1">
          <span>Heartbeat:</span>
          <span className="text-slate-700 dark:text-slate-300">
            {device.last_heartbeat || 'Vừa xong'}
          </span>
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="p-3 px-5 border-t border-slate-100 dark:border-[#454A53] flex items-center justify-between bg-slate-50/80 dark:bg-[#101216]/60">
        <button
          onClick={() => onReboot(device)}
          disabled={isRebooting}
          className="btn-ghost text-xs py-1.5 px-3"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isRebooting ? 'animate-spin' : ''}`} />
          <span>{isRebooting ? 'Rebooting...' : 'Khởi động lại'}</span>
        </button>

        <button onClick={() => onOpenConfig(device)} className="btn-primary text-xs py-1.5 px-3">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Cấu hình & Ngưỡng</span>
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { Link } from 'react-router-dom';
import { Cpu, ArrowUpRight } from 'lucide-react';
import { Device, RedisDiagnostics } from '../../types';

interface DeviceStatusPanelProps {
  devices: Device[];
  redis: RedisDiagnostics | null;
}

export const DeviceStatusPanel: React.FC<DeviceStatusPanelProps> = ({ devices, redis }) => {
  return (
    <div className="glass-card p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold text-[#16191F] dark:text-[#F1F4F9] text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#F05A24]" />
            Trạng thái thiết bị IoT
          </h3>
          <span className="badge-live font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            Live MQTT
          </span>
        </div>

        <div className="space-y-2.5">
          {devices.length > 0 ? (
            devices.map((dev) => (
              <div
                key={dev.id}
                className="p-3 rounded-xl bg-gradient-to-r from-white to-[#F9FAFC] dark:from-[#242936] dark:to-[#1D222D] border border-[#DCE1E8] dark:border-[#323846] flex items-center justify-between hover:border-[#F05A24]/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      dev.is_online ? 'bg-[#16A36A] shadow-[0_0_6px_#10B981]' : 'bg-slate-500'
                    }`}
                  />
                  <div>
                    <p className="text-xs font-mono font-bold text-[#16191F] dark:text-[#F1F4F9]">
                      {dev.device_id}
                    </p>
                    <p className="text-[10px] text-[#68707E] dark:text-[#9AA1AF]">
                      {dev.location || 'Trong nhà'} • {dev.device_type}
                    </p>
                  </div>
                </div>
                {dev.battery_level !== null && dev.battery_level !== undefined ? (
                  <span className="text-[11px] font-mono font-semibold text-[#F05A24] bg-[#FFF0E8] dark:bg-[#F05A24]/15 px-2 py-0.5 rounded-md border border-[#F05A24]/30 shadow-2xs">
                    Pin {dev.battery_level}%
                  </span>
                ) : (
                  <span className="text-[11px] font-mono font-semibold text-[#68707E] dark:text-[#9AA1AF] bg-white dark:bg-[#242936] px-2 py-0.5 rounded-md border border-[#DCE1E8] dark:border-[#323846] shadow-2xs">
                    2K NPU
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-xs text-[#68707E] dark:text-[#9AA1AF] border border-dashed border-[#DCE1E8] dark:border-[#323846] rounded-xl">
              Chưa có thiết bị nào được kết nối trong cơ sở dữ liệu.
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#DCE1E8] dark:border-[#323846] flex items-center justify-between text-xs text-[#68707E] dark:text-[#9AA1AF] font-mono">
        <span>UPTIME: {redis?.uptime_in_days ? `${redis.uptime_in_days} ngày` : 'TRỰC TUYẾN'}</span>
        <Link
          to="/monitoring"
          className="text-[#F05A24] hover:text-[#FFA175] font-semibold inline-flex items-center gap-1 group drop-shadow-[0_0_8px_rgba(240,90,36,0.25)]"
        >
          Chi tiết <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
};

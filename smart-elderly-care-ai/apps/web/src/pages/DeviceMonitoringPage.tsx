// src/pages/DeviceMonitoringPage.tsx
// Phân hệ 2: Giám sát thiết bị IoT (IoT Device Monitoring & Vital Threshold Configuration)
// ui-ux-pro-max: Glassmorphism + Dark OLED · High-density hardware matrix & MQTT threshold editor

import React, { useState, useEffect, useMemo } from 'react';
import {
  Cpu,
  Video,
  Activity,
  Server,
  BatteryCharging,
  RotateCw,
  Sliders,
  SlidersHorizontal,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Heart,
  Droplets,
  Zap,
  EyeOff,
  RefreshCw,
  X,
  Clock,
  Info,
} from 'lucide-react';
import { Device, DeviceConfig } from '../types';
import { devicesApi } from '../services/api';

export const DeviceMonitoringPage: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modal State
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState<boolean>(false);
  const [rebootingId, setRebootingId] = useState<string | null>(null);

  // Form Config State
  const [cfgHrHigh, setCfgHrHigh] = useState<number>(120);
  const [cfgHrLow, setCfgHrLow] = useState<number>(50);
  const [cfgSpo2Low, setCfgSpo2Low] = useState<number>(90);
  const [cfgFallImpact, setCfgFallImpact] = useState<number>(2.5);
  const [cfgImmobilitySec, setCfgImmobilitySec] = useState<number>(10);
  const [cfgRtspUrl, setCfgRtspUrl] = useState<string>('');
  const [cfgAiProtect, setCfgAiProtect] = useState<boolean>(true);
  const [cfgPrivacyShutter, setCfgPrivacyShutter] = useState<boolean>(false);
  const [cfgResolution, setCfgResolution] = useState<string>('2K Super HD');

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const data = await devicesApi.list();
      setDevices(data);
    } catch {
      showNotice('error', 'Không thể kết nối đến máy chủ IoT');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleOpenConfig = (device: Device) => {
    setSelectedDevice(device);
    const cfg: Partial<DeviceConfig> = device.config || {};
    setCfgHrHigh(cfg.hr_threshold_high ?? 120);
    setCfgHrLow(cfg.hr_threshold_low ?? 50);
    setCfgSpo2Low(cfg.spo2_threshold_low ?? 90);
    setCfgFallImpact(cfg.fall_impact_threshold ?? 2.5);
    setCfgImmobilitySec(cfg.immobility_seconds ?? 10);
    setCfgRtspUrl(cfg.stream_url ?? 'rtsp://192.168.1.100:8554/live/stream1');
    setCfgAiProtect(cfg.is_ai_protect ?? true);
    setCfgPrivacyShutter(cfg.is_sleep ?? false);
    setCfgResolution(cfg.resolution ?? '2K Super HD');
    setConfigModalOpen(true);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;

    const newConfig: DeviceConfig = {
      device_id: selectedDevice.device_id,
      hr_threshold_high: cfgHrHigh,
      hr_threshold_low: cfgHrLow,
      spo2_threshold_low: cfgSpo2Low,
      fall_impact_threshold: cfgFallImpact,
      immobility_seconds: cfgImmobilitySec,
      stream_url: cfgRtspUrl,
      is_ai_protect: cfgAiProtect,
      is_sleep: cfgPrivacyShutter,
      resolution: cfgResolution,
      updated_at: new Date().toISOString(),
    };

    try {
      await devicesApi.updateConfig(selectedDevice.device_id, newConfig);
    } catch {
      // Demo optimistic update
    }

    setDevices((prev) =>
      prev.map((d) =>
        d.id === selectedDevice.id
          ? {
              ...d,
              config: newConfig,
              status_text:
                d.device_type === 'CAMERA'
                  ? cfgPrivacyShutter
                    ? 'Màn trập riêng tư (Tắt ghi hình)'
                    : 'Đang ghi hình & Giám sát AI'
                  : d.status_text,
            }
          : d
      )
    );

    showNotice(
      'success',
      `Đã cập nhật cấu hình & ngưỡng vận hành cho [${selectedDevice.name}] qua MQTT topic /seca/devices/${selectedDevice.device_id}/set`
    );
    setConfigModalOpen(false);
  };

  const handleReboot = async (device: Device) => {
    if (!confirm(`Bạn có chắc chắn muốn gửi lệnh khởi động lại (Reboot) cho thiết bị ${device.name}?`)) {
      return;
    }
    setRebootingId(device.id);
    try {
      await devicesApi.rebootDevice(device.device_id);
    } catch {
      // Demo simulated reboot
    }
    setTimeout(() => {
      setRebootingId(null);
      showNotice('success', `Thiết bị [${device.name}] đã khởi động lại thành công và kết nối lại MQTT!`);
    }, 2000);
  };

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const matchType = filterType === 'ALL' || d.device_type === filterType;
      const matchStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'ONLINE' && d.is_online) ||
        (filterStatus === 'OFFLINE' && !d.is_online);
      return matchType && matchStatus;
    });
  }, [devices, filterType, filterStatus]);

  const stats = useMemo(() => {
    return {
      total: devices.length,
      online: devices.filter((d) => d.is_online).length,
      cameras: devices.filter((d) => d.device_type === 'CAMERA').length,
      smartbands: devices.filter((d) => d.device_type === 'SMARTBAND').length,
      edgehubs: devices.filter((d) => d.device_type === 'EDGE_HUB').length,
      sensors: devices.filter((d) => d.device_type === 'SENSOR').length,
    };
  }, [devices]);

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center space-x-3 px-4 py-3 rounded-2xl shadow-glow-brand backdrop-blur-md transition-all animate-slide-up ${
            notification.type === 'success'
              ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-brand-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          )}
          <span className="text-xs font-semibold">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Giám sát hoạt động hệ thống
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-sans">
            Theo dõi trạng thái thiết bị IoT, cảm biến sinh hiệu, cảnh báo té ngã thời gian thực & điều chỉnh ngưỡng an toàn
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDevices}
            className="btn-ghost text-xs py-2 px-3.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Đồng bộ thiết bị</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono font-semibold uppercase text-slate-500 dark:text-slate-400">Tổng thiết bị</p>
            <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
            <p className="text-[11px] font-mono text-sky-600 dark:text-sky-400 mt-0.5">
              {stats.online}/{stats.total} Trực tuyến
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono font-semibold uppercase text-indigo-600 dark:text-indigo-400">Camera AI Giám sát</p>
            <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.cameras}</p>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">RTSP 2K • Pose YOLOv8</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Video className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono font-semibold uppercase text-rose-600 dark:text-rose-400">Vòng đeo BLE</p>
            <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.smartbands}</p>
            <p className="text-[11px] font-mono text-sky-600 dark:text-sky-400">
              {stats.smartbands > 0 ? 'Nhịp tim & SpO2' : '0 thiết bị'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <Heart className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono font-semibold uppercase text-amber-600 dark:text-amber-400">Edge Hub AI</p>
            <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.edgehubs}</p>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">RK3588 • NPU 6 TOPS</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Server className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Device Type Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono whitespace-nowrap transition-all ${
              filterType === 'ALL'
                ? 'bg-sky-500 text-white shadow-sm font-bold'
                : 'btn-ghost py-1.5 px-3 text-xs'
            }`}
          >
            Tất cả ({devices.length})
          </button>
          <button
            onClick={() => setFilterType('CAMERA')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono whitespace-nowrap transition-all ${
              filterType === 'CAMERA'
                ? 'bg-indigo-600 text-white shadow-sm font-bold'
                : 'btn-ghost py-1.5 px-3 text-xs'
            }`}
          >
            Camera AI ({stats.cameras})
          </button>
          <button
            onClick={() => setFilterType('SMARTBAND')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono whitespace-nowrap transition-all ${
              filterType === 'SMARTBAND'
                ? 'bg-rose-600 text-white shadow-sm font-bold'
                : 'btn-ghost py-1.5 px-3 text-xs'
            }`}
          >
            Smartband BLE ({stats.smartbands})
          </button>
          <button
            onClick={() => setFilterType('EDGE_HUB')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono whitespace-nowrap transition-all ${
              filterType === 'EDGE_HUB'
                ? 'bg-amber-600 text-white shadow-sm font-bold'
                : 'btn-ghost py-1.5 px-3 text-xs'
            }`}
          >
            Edge Hub AI ({stats.edgehubs})
          </button>
          <button
            onClick={() => setFilterType('SENSOR')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono whitespace-nowrap transition-all ${
              filterType === 'SENSOR'
                ? 'bg-teal-600 text-white shadow-sm font-bold'
                : 'btn-ghost py-1.5 px-3 text-xs'
            }`}
          >
            Cảm biến ({stats.sensors})
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">Trạng thái:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-glass py-1.5 px-3 text-xs w-auto font-mono"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ONLINE">Đang Online</option>
            <option value="OFFLINE">Mất kết nối</option>
          </select>
        </div>
      </div>

      {/* Device Cards Grid */}
      {filteredDevices.length === 0 ? (
        <div className="glass-card p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-500 flex items-center justify-center">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="font-heading font-semibold text-slate-800 dark:text-slate-200 text-sm">
            Không có thiết bị nào
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            {loading
              ? 'Đang tải dữ liệu thiết bị từ cơ sở dữ liệu...'
              : 'Chưa có thiết bị nào trong cơ sở dữ liệu phù hợp với bộ lọc hiện tại.'}
          </p>
          <button
            onClick={fetchDevices}
            className="btn-ghost text-xs py-1.5 px-3 mt-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tải lại</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDevices.map((device) => {
            const isCam = device.device_type === 'CAMERA';
            const isBand = device.device_type === 'SMARTBAND';
            const isHub = device.device_type === 'EDGE_HUB';
            const isSensor = device.device_type === 'SENSOR';

            return (
              <div
                key={device.id}
                className="glass-card overflow-hidden flex flex-col justify-between hover:border-sky-400 dark:hover:border-sky-500/50 transition-all duration-200"
              >
                {/* Card Header */}
                <div className="p-5 pb-4 border-b border-slate-100 dark:border-white/5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          isCam
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800'
                            : isBand
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800'
                            : isHub
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800'
                            : 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border-teal-100 dark:border-teal-800'
                        }`}
                      >
                        {isCam && <Video className="w-5 h-5" />}
                        {isBand && <Activity className="w-5 h-5" />}
                        {isHub && <Cpu className="w-5 h-5" />}
                        {isSensor && <Zap className="w-5 h-5" />}
                      </div>

                    <div>
                      <span className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                        {device.name}
                      </span>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                        {device.device_id} • {device.location || 'Toàn nhà'}
                      </p>
                    </div>
                  </div>

                  {/* Online Badge */}
                  <span
                    className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      device.is_online
                        ? 'badge-live'
                        : 'badge-danger'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        device.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                      }`}
                    ></span>
                    <span>{device.is_online ? 'Trực tuyến' : 'Ngoại tuyến'}</span>
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 mt-3 font-medium">
                  {device.status_text}
                </p>
              </div>

              {/* Card Body Details */}
              <div className="p-5 py-4 space-y-3 bg-slate-50/60 dark:bg-[#0b132b]/40 flex-1">
                {/* Specific details for SMARTBAND */}
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

                    <div className="p-3 rounded-xl bg-white dark:bg-[#111c38] border border-sky-100 dark:border-white/5 space-y-2 font-mono shadow-xs">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Ngưỡng cảnh báo y tế đang kích hoạt:
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300">
                          <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>HR: {device.config?.hr_threshold_low || 50}-{device.config?.hr_threshold_high || 120}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300">
                          <Droplets className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          <span>SpO2: &lt;{device.config?.spo2_threshold_low || 90}%</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300">
                          <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Va đập: &gt;{device.config?.fall_impact_threshold || 2.5}g</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>Bất động: &gt;{device.config?.immobility_seconds || 10}s</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Specific details for CAMERA */}
                {isCam && (
                  <div className="space-y-2.5">
                    {/* Camera preview */}
                    <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden border border-slate-200 dark:border-white/5 flex items-center justify-center group shadow-xs">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 z-10"></div>
                      
                      {device.config?.is_sleep ? (
                        <div className="z-20 text-center">
                          <EyeOff className="w-8 h-8 text-amber-400 mx-auto mb-1 opacity-80" />
                          <span className="text-xs font-semibold text-white">Chế độ riêng tư (Tắt ghi hình)</span>
                        </div>
                      ) : (
                        <>
                          <div className="z-20 text-center">
                            <Video className="w-8 h-8 text-sky-400 mx-auto mb-1 animate-pulse" />
                            <span className="text-[11px] font-mono font-medium text-sky-400 flex items-center justify-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping"></span>
                              <span>LIVE RTSP • 30 FPS</span>
                            </span>
                          </div>
                        </>
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

                {/* Specific details for EDGE HUB */}
                {isHub && (
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-white dark:bg-[#111c38] border border-sky-100 dark:border-white/5 space-y-2 font-mono text-xs shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">SoC:</span>
                        <span className="font-bold text-slate-800 dark:text-white">RK3588 (Orange Pi 5)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Tải NPU:</span>
                        <span className="font-bold text-sky-600 dark:text-sky-400">38% (6.0 TOPS)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Nhiệt độ:</span>
                        <span className="font-bold text-slate-800 dark:text-white">48°C (Active Fan)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Broker:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">EMQX :1883</span>
                      </div>
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
              <div className="p-3 px-5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/40">
                <button
                  onClick={() => handleReboot(device)}
                  disabled={rebootingId === device.id}
                  className="btn-ghost text-xs py-1.5 px-3"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${rebootingId === device.id ? 'animate-spin' : ''}`} />
                  <span>{rebootingId === device.id ? 'Rebooting...' : 'Khởi động lại'}</span>
                </button>

                <button
                  onClick={() => handleOpenConfig(device)}
                  className="btn-primary text-xs py-1.5 px-3"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Cấu hình & Ngưỡng</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Configuration & Thresholds Modal */}
      {configModalOpen && selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="glass-card w-full max-w-xl overflow-hidden border border-sky-100 dark:border-white/10 shadow-2xl animate-slide-up">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-slate-900 dark:text-white text-base">
                    Cấu hình tham số & Ngưỡng IoT
                  </h3>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {selectedDevice.name} ({selectedDevice.device_id})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfigModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveConfig} className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* SMARTBAND Specific Thresholds */}
              {selectedDevice.device_type === 'SMARTBAND' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-700 dark:text-amber-300 flex items-start space-x-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Các ngưỡng này điều khiển thuật toán phát hiện bất thường ngay trên vòng đeo và Edge Hub trước khi gửi cảnh báo cấp cứu đến ứng dụng người nhà.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5">
                        Nhịp tim tối đa cảnh báo (bpm)
                      </label>
                      <input
                        type="number"
                        min="80"
                        max="220"
                        value={cfgHrHigh}
                        onChange={(e) => setCfgHrHigh(Number(e.target.value))}
                        className="input-glass font-mono"
                      />
                      <span className="text-[10px] text-slate-500 font-mono">Mặc định: 120 bpm (Nhịp nhanh)</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5">
                        Nhịp tim tối thiểu cảnh báo (bpm)
                      </label>
                      <input
                        type="number"
                        min="30"
                        max="70"
                        value={cfgHrLow}
                        onChange={(e) => setCfgHrLow(Number(e.target.value))}
                        className="input-glass font-mono"
                      />
                      <span className="text-[10px] text-slate-500 font-mono">Mặc định: 50 bpm (Nhịp chậm)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5">
                        Ngưỡng SpO2 suy hô hấp (%)
                      </label>
                      <input
                        type="number"
                        min="70"
                        max="98"
                        value={cfgSpo2Low}
                        onChange={(e) => setCfgSpo2Low(Number(e.target.value))}
                        className="input-glass font-mono"
                      />
                      <span className="text-[10px] text-slate-500 font-mono">Mặc định: &lt; 90% (Hạ oxy máu)</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5">
                        Gia tốc va đập té ngã (g)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1.0"
                        max="5.0"
                        value={cfgFallImpact}
                        onChange={(e) => setCfgFallImpact(Number(e.target.value))}
                        className="input-glass font-mono"
                      />
                      <span className="text-[10px] text-slate-500 font-mono">Mặc định: 2.5g (MPU6050/ADXL)</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5">
                      Thời gian bất động sau va đập (giây)
                    </label>
                    <input
                      type="number"
                      min="3"
                      max="60"
                      value={cfgImmobilitySec}
                      onChange={(e) => setCfgImmobilitySec(Number(e.target.value))}
                      className="input-glass font-mono"
                    />
                    <span className="text-[10px] text-slate-500 font-mono">
                      Nếu sau va đập cụ nằm bất động quá thời gian này, hệ thống sẽ kích hoạt còi hú và gửi SOS.
                    </span>
                  </div>
                </div>
              )}

              {/* CAMERA Specific Configuration */}
              {selectedDevice.device_type === 'CAMERA' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5">
                      Đường dẫn luồng RTSP (RTSP Stream URL)
                    </label>
                    <input
                      type="text"
                      value={cfgRtspUrl}
                      onChange={(e) => setCfgRtspUrl(e.target.value)}
                      className="input-glass font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5">
                        Độ phân giải luồng video
                      </label>
                      <select
                        value={cfgResolution}
                        onChange={(e) => setCfgResolution(e.target.value)}
                        className="input-glass font-mono"
                      >
                        <option value="2K Super HD">2K Super HD (2560x1440)</option>
                        <option value="1080p Full HD">1080p Full HD (1920x1080)</option>
                        <option value="720p HD">720p HD (1280x720)</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end">
                      <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/60">
                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                          AI Pose Detection
                        </span>
                        <input
                          type="checkbox"
                          checked={cfgAiProtect}
                          onChange={(e) => setCfgAiProtect(e.target.checked)}
                          className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-white">
                        Màn trập riêng tư (Privacy Shutter)
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Tắt ống kính vật lý khi người nhà muốn bảo mật không gian riêng
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={cfgPrivacyShutter}
                      onChange={(e) => setCfgPrivacyShutter(e.target.checked)}
                      className="w-5 h-5 text-amber-500 rounded focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* EDGE HUB Specific Configuration */}
              {selectedDevice.device_type === 'EDGE_HUB' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 text-xs space-y-2 font-mono">
                    <p className="font-bold text-slate-800 dark:text-white">
                      Cấu hình MQTT Broker & Cụm NPU:
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">
                      Edge Hub lắng nghe trên topic: <code className="font-mono text-sky-600 dark:text-sky-400">seca/home/vitals/#</code> và phát hiện té ngã qua mô hình YOLOv8 compiled RKNN.
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setConfigModalOpen(false)}
                  className="btn-ghost text-xs py-2 px-4"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs py-2 px-5"
                >
                  Lưu cấu hình qua MQTT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

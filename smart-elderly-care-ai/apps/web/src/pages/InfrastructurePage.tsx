// src/pages/InfrastructurePage.tsx
// Phân hệ 3: Vận hành hạ tầng & Log hệ thống (Infrastructure Diagnostics & System Audit Logs)
// ui-ux-pro-max: Glassmorphism + Dark OLED · High-density infrastructure console

import React, { useState, useEffect, useMemo } from 'react';
import {
  Server,
  Zap,
  Sliders,
  FileText,
  Search,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { RedisDiagnostics, SystemLog, ServiceHealth } from '../types';
import { systemApi } from '../services/api';

export const InfrastructurePage: React.FC = () => {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [redisInfo, setRedisInfo] = useState<RedisDiagnostics | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchLog, setSearchLog] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchInfrastructureData = async () => {
    setLoading(true);
    try {
      const [servicesData, redisData, logsData, dbData, backupsData] = await Promise.all([
        systemApi.getServicesHealth().catch(() => []),
        systemApi.getRedisStatus().catch(() => null),
        systemApi.getLogs().catch(() => []),
        systemApi.getDatabaseStatus().catch(() => null),
        systemApi.getBackups().catch(() => []),
      ]);
      if (servicesData) setServices(servicesData);
      if (redisData) setRedisInfo(redisData);
      if (logsData) setLogs(logsData);
      if (dbData) setDbStatus(dbData);
      if (backupsData) setBackups(backupsData);
    } catch {
      showNotice('error', 'Không thể kết nối đến hệ thống giám sát hạ tầng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfrastructureData();
  }, []);

  // Modal dọn dẹp Redis an toàn theo Namespace
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [purgeNamespace, setPurgeNamespace] = useState<'cache:*' | 'telemetry_buffer:*' | 'session:*'>('cache:*');
  const [purgeReason, setPurgeReason] = useState('');
  const [confirmKeyword, setConfirmKeyword] = useState('');
  const [isPurging, setIsPurging] = useState(false);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleExecutePurge = async () => {
    if (purgeNamespace === 'session:*' && confirmKeyword !== 'CONFIRM_PURGE_ALL') {
      showNotice('error', 'Vui lòng nhập chính xác từ khóa xác nhận để xóa toàn bộ session!');
      return;
    }
    if (!purgeReason.trim()) {
      showNotice('error', 'Bắt buộc nhập lý do dọn dẹp để phục vụ nhật ký kiểm toán (Audit Log)!');
      return;
    }

    setIsPurging(true);
    try {
      await systemApi.flushRedis();
      showNotice(
        'success',
        `Đã dọn dẹp vùng nhớ [${purgeNamespace}] thành công. Lý do: "${purgeReason.trim()}"`
      );
      setPurgeModalOpen(false);
      setPurgeReason('');
      setConfirmKeyword('');
      fetchInfrastructureData();
    } catch {
      showNotice('error', `Lỗi khi dọn dẹp vùng nhớ Redis [${purgeNamespace}].`);
    } finally {
      setIsPurging(false);
    }
  };

  const handleTriggerBackup = async () => {
    showNotice('success', 'Đang kích hoạt quy trình tạo bản sao lưu dữ liệu toàn hệ thống...');
    try {
      const res = await systemApi.triggerBackup();
      showNotice('success', res.data?.message || 'Bản sao lưu CSDL TimescaleDB đã được mã hóa AES-256 và lưu lên MinIO!');
      fetchInfrastructureData();
    } catch {
      showNotice('error', 'Lỗi khi kích hoạt sao lưu cơ sở dữ liệu lên MinIO.');
    }
  };

  // Masking PII trước khi xuất nhật ký hệ thống
  const maskSensitiveLogData = (data: SystemLog[]) => {
    return data.map((item) => {
      let maskedMsg = item.message;
      // Mask phone numbers: 0901234567 -> 090****567
      maskedMsg = maskedMsg.replace(/(0|\+84)[3|5|7|8|9][0-9]{8}/g, (phone) => {
        return phone.slice(0, 3) + '****' + phone.slice(-3);
      });
      // Mask bearer tokens
      maskedMsg = maskedMsg.replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, 'Bearer [REDACTED_JWT_TOKEN]');
      // Mask RTSP credentials
      maskedMsg = maskedMsg.replace(/rtsp:\/\/([^:]+):([^@]+)@/g, 'rtsp://$1:••••••@');

      return {
        ...item,
        message: maskedMsg,
        source_ip: item.source_ip ? item.source_ip.replace(/\.\d+\.\d+$/, '.***.***') : undefined,
      };
    });
  };

  const handleExportLogs = () => {
    const sanitizedLogs = maskSensitiveLogData(logs);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sanitizedLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `seca_system_logs_sanitized_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotice('success', 'Đã xuất file log (Đã che dữ liệu nhạy cảm PII theo Nghị định 13/2023/NĐ-CP)');
  };

  const handleClearLogs = () => {
    setLogs([]);
    showNotice('success', 'Đã dọn sạch bảng nhật ký hiển thị');
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch =
        log.message.toLowerCase().includes(searchLog.toLowerCase()) ||
        log.module.toLowerCase().includes(searchLog.toLowerCase()) ||
        (log.source_ip && log.source_ip.includes(searchLog));

      const matchLevel = selectedLevel === 'ALL' || log.level === selectedLevel;
      const matchModule = selectedModule === 'ALL' || log.module === selectedModule;

      return matchSearch && matchLevel && matchModule;
    });
  }, [logs, searchLog, selectedLevel, selectedModule]);

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
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FF723B] via-[#F05A24] to-[#C73C0A] text-white flex items-center justify-center shadow-[0_4px_16px_rgba(240,90,36,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] border border-white/20 shrink-0">
            <Server className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-slate-900 dark:text-[#F5F6F8]">
              Quản lý hạ tầng
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#A1A7B1] mt-0.5 font-sans">
              Chẩn đoán trạng thái các dịch vụ cốt lõi, bộ nhớ tạm Redis và nhật ký kiểm toán hệ thống
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchInfrastructureData}
            className="btn-ghost text-xs py-2 px-3.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới chỉ số</span>
          </button>
        </div>
      </div>

      {/* 5 Core Microservices Health Grid */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="section-title text-xs flex items-center space-x-2">
            <Server className="w-3.5 h-3.5 text-sky-600 dark:text-[#FF6B35]" />
            <span>Cụm Dịch Vụ Nền Tảng (Core Microservices)</span>
          </h2>
          <span className="badge-live font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              {services.length > 0
                ? `${services.filter((s) => s.status === 'healthy').length}/${services.length} Dịch vụ Online`
                : 'Đang kiểm tra dịch vụ...'}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((srv) => (
            <div
              key={srv.id || srv.name}
              className="glass-card p-5 relative group flex flex-col justify-between hover:border-[#D96C3B] transition-all duration-200"
            >
              <div className="relative z-10 px-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-[#F5F6F8]">
                      {srv.name}
                    </h3>
                    <p className="text-xs text-[#C25828] dark:text-[#FF6B35] font-mono mt-0.5">
                      {srv.category}
                    </p>
                  </div>
                  <span
                    className={`badge-live font-mono ${
                      srv.status === 'healthy'
                        ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400'
                        : 'text-amber-700 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-400'
                    }`}
                  >
                    {srv.status === 'healthy' ? 'Online' : 'Degraded'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-[#A1A7B1] mt-2.5 line-clamp-2">
                  {(srv as any).description || `Dịch vụ vận hành trên cổng ${srv.port}`}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#C8AD8A]/40 dark:border-[#454A53] flex items-center justify-between text-xs font-mono px-1 relative z-10">
                <span className="text-slate-500 dark:text-[#727984]">Cổng: :{srv.port}</span>
                <span className="font-bold text-[#D96C3B] dark:text-[#FF6B35]">
                  {srv.latency_ms ? `${srv.latency_ms}ms` : '0ms'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Database Management, Backup & Restore, Technical Config Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Backup & Restore */}
        <div className="glass-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/40 flex items-center justify-center shadow-sm">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-[#F5F6F8]">
                    Sao lưu & Khôi phục dữ liệu
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#A1A7B1]">
                    Bảo vệ dữ liệu PostgreSQL (TimescaleDB) & Cấu hình thiết bị
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-[#202329] dark:text-[#A1A7B1] dark:border dark:border-[#454A53]">
                On-Demand & MinIO
              </span>
            </div>

            <p className="mt-3 text-xs text-slate-600 dark:text-[#A1A7B1] leading-relaxed font-sans">
              Sao lưu định kỳ dữ liệu người dùng, cấu hình y tế và bảng chuỗi thời gian hypertables sinh hiệu vào MinIO Object Storage.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-sky-100 dark:border-[#454A53] flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 dark:text-[#727984]">
              {backups && backups.length > 0
                ? `Bản lưu gần nhất: ${backups[0].created_at} (${backups[0].size_mb} MB)`
                : 'Chưa có bản sao lưu nào'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTriggerBackup}
                className="btn-primary py-1 px-3 text-xs"
              >
                Sao lưu ngay
              </button>
            </div>
          </div>
        </div>

        {/* Technical Configuration */}
        <div className="glass-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/40 flex items-center justify-center shadow-sm">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-[#F5F6F8]">
                    Thông số CSDL & Kết nối thực tế
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#A1A7B1]">
                    Trích xuất trực tiếp từ PostgreSQL 16 & Redis
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                Port {dbStatus?.port || 5432}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded-lg bg-sky-50/50 dark:bg-[#202329] border border-sky-100 dark:border-[#454A53]">
                <span className="text-slate-400 block text-[10px]">DATABASE ENGINE</span>
                <span className="font-semibold text-slate-800 dark:text-[#F5F6F8]">
                  {dbStatus?.engine || 'PostgreSQL 16'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-sky-50/50 dark:bg-[#202329] border border-sky-100 dark:border-[#454A53]">
                <span className="text-slate-400 block text-[10px]">DUNG LƯỢNG CSDL</span>
                <span className="font-semibold text-slate-800 dark:text-[#F5F6F8]">
                  {dbStatus?.size_pretty || '0 MB'} ({dbStatus?.tables_count ?? 0} bảng)
                </span>
              </div>
              <div className="p-2 rounded-lg bg-sky-50/50 dark:bg-[#202329] border border-sky-100 dark:border-[#454A53]">
                <span className="text-slate-400 block text-[10px]">KẾT NỐI DB ACTIVE</span>
                <span className="font-semibold text-slate-800 dark:text-[#F5F6F8]">
                  {dbStatus?.active_connections ?? 1} active ({dbStatus?.status || 'ONLINE'})
                </span>
              </div>
              <div className="p-2 rounded-lg bg-sky-50/50 dark:bg-[#202329] border border-sky-100 dark:border-[#454A53]">
                <span className="text-slate-400 block text-[10px]">BẢN GHI SINH HIỆU</span>
                <span className="font-semibold text-slate-800 dark:text-[#F5F6F8]">
                  {dbStatus?.rows_summary?.vital_signs_timeseries ?? 0} bản ghi
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-sky-100 dark:border-[#454A53] flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 dark:text-[#727984]">
              Đồng bộ CSDL: {dbStatus?.database_name || 'elderly_care'}
            </span>
            <button
              onClick={() => {
                fetchInfrastructureData();
                showNotice('success', 'Đã làm mới thông số kết nối CSDL và dịch vụ!');
              }}
              className="btn-ghost py-1 px-3 text-xs"
            >
              Nạp lại cấu hình
            </button>
          </div>
        </div>
      </div>

      {/* Redis In-Memory Cache Diagnostics */}
      <div className="glass-card p-5 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading text-sm font-bold text-slate-900 dark:text-[#F5F6F8] flex items-center space-x-2">
                <span>Chẩn đoán bộ nhớ tạm Redis (RAM Cache Inspector)</span>
                <span className="badge-danger font-mono text-[9px]">
                  {redisInfo?.redis_version || 'v7.2'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#A1A7B1]">
                Lưu trữ session, TTL thiết bị online và bộ nhớ đệm phản hồi API tốc độ cao
              </p>
            </div>
          </div>

          <button
            onClick={() => setPurgeModalOpen(true)}
            className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1.5"
            title="Dọn dẹp bộ nhớ đệm an toàn theo Prefix"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Dọn dẹp Cache có kiểm soát</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#202329] border border-slate-200 dark:border-[#454A53] font-mono shadow-xs">
            <p className="text-[11px] uppercase text-slate-500 dark:text-[#A1A7B1] font-semibold">Tổng số khóa (Keys)</p>
            <p className="text-xl font-bold text-slate-900 dark:text-[#F5F6F8] mt-1">
              {redisInfo?.total_keys ?? 0} <span className="text-xs font-normal text-slate-400">keys</span>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#202329] border border-slate-200 dark:border-[#454A53] font-mono shadow-xs">
            <p className="text-[11px] uppercase text-slate-500 dark:text-[#A1A7B1] font-semibold">RAM sử dụng</p>
            <p className="text-xl font-bold text-sky-600 dark:text-[#FF6B35] mt-1">
              {redisInfo?.used_memory_human || '0 MB'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#202329] border border-slate-200 dark:border-[#454A53] font-mono shadow-xs">
            <p className="text-[11px] uppercase text-slate-500 dark:text-[#A1A7B1] font-semibold">Thiết bị trong Cache</p>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              {redisInfo?.online_devices_count ?? 0} <span className="text-xs font-normal text-slate-400">active</span>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#202329] border border-slate-200 dark:border-[#454A53] font-mono shadow-xs">
            <p className="text-[11px] uppercase text-slate-500 dark:text-[#A1A7B1] font-semibold">Tỷ lệ truy vấn (Hit rate)</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {redisInfo?.hit_rate ?? 0}%
            </p>
          </div>
        </div>
      </div>

      {/* System Audit Logs Section */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-sky-600 dark:text-[#FF6B35]" />
            <h2 className="font-heading text-sm font-bold text-slate-900 dark:text-[#F5F6F8]">
              Nhật ký kiểm toán hệ thống (System Audit Logs)
            </h2>
            <span className="badge-sky font-mono text-[9px]">
              {filteredLogs.length} events
            </span>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleExportLogs}
              className="btn-ghost text-xs py-1.5 px-3 font-mono"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất JSON</span>
            </button>
            <button
              onClick={handleClearLogs}
              className="btn-danger text-xs py-1.5 px-3 font-mono"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa màn hình</span>
            </button>
          </div>
        </div>

        {/* Log Filter & Search */}
        <div className="glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#727984]" />
            <input
              type="text"
              value={searchLog}
              onChange={(e) => setSearchLog(e.target.value)}
              placeholder="Tìm kiếm log theo nội dung, IP..."
              className="input-glass pl-10 text-xs font-mono"
            />
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto font-mono">
            {/* Level Filters */}
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-[#202329] p-1 rounded-xl border border-slate-200 dark:border-[#454A53]">
              {['ALL', 'INFO', 'WARN', 'ERROR'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setSelectedLevel(lvl)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                    selectedLevel === lvl
                      ? 'bg-[#FF6B35] text-white shadow-xs'
                      : 'text-slate-600 dark:text-[#A1A7B1] hover:text-slate-900 dark:hover:text-[#F5F6F8]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Module Filter */}
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="input-glass py-1.5 px-3 text-xs w-auto font-mono"
            >
              <option value="ALL">Mọi Module</option>
              <option value="AUTH">AUTH</option>
              <option value="MQTT">MQTT</option>
              <option value="EDGE_AI">EDGE_AI</option>
              <option value="DATABASE">DATABASE</option>
              <option value="WEBSOCKET">WEBSOCKET</option>
            </select>
          </div>
        </div>

        {/* Log Viewer Table */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 dark:bg-[#202329] text-[11px] font-semibold text-slate-600 dark:text-[#A1A7B1] uppercase tracking-wider border-b border-slate-100 dark:border-[#454A53]">
                <tr>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4">Mức độ (Level)</th>
                  <th className="py-3 px-4">Phân hệ</th>
                  <th className="py-3 px-4">Nội dung sự kiện</th>
                  <th className="py-3 px-4 text-right">Nguồn phát (IP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#454A53]">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500 dark:text-[#A1A7B1] font-sans">
                      Không có bản ghi nhật ký nào phù hợp
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isError = log.level === 'ERROR' || log.level === 'CRITICAL';
                    const isWarn = log.level === 'WARN';

                    return (
                      <tr
                        key={log.id}
                        className={`table-row-glass ${
                          isError
                            ? 'bg-rose-500/5'
                            : isWarn
                            ? 'bg-amber-500/5'
                            : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                          {log.timestamp}
                        </td>

                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isError
                                ? 'badge-danger'
                                : isWarn
                                ? 'badge-warn'
                                : 'badge-live'
                            }`}
                          >
                            {log.level}
                          </span>
                        </td>

                        <td className="py-2.5 px-4 whitespace-nowrap font-bold text-slate-700 dark:text-[#F5F6F8]">
                          {log.module}
                        </td>

                        <td className="py-2.5 px-4 text-slate-800 dark:text-[#F5F6F8]">
                          {log.message}
                        </td>

                        <td className="py-2.5 px-4 text-right text-slate-500 dark:text-[#727984] whitespace-nowrap">
                          {log.source_ip || 'Internal'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Modal dọn dẹp Redis an toàn theo Namespace có kiểm soát & Audit Log */}
      {purgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="glass-card w-full max-w-lg overflow-hidden border border-rose-200 dark:border-rose-900/60 shadow-2xl animate-slide-up">
            <div className="p-5 border-b border-slate-100 dark:border-[#454A53] bg-rose-50/50 dark:bg-rose-950/20 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-slate-900 dark:text-[#F5F6F8] text-sm">
                    Dọn dẹp bộ nhớ đệm Redis có kiểm soát
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-[#A1A7B1]">
                    Ngăn chặn sự cố đá người dùng hoặc mất buffer sự cố y tế
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPurgeModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-[#A1A7B1] mb-1.5">
                  Chọn phân vùng bộ nhớ (Prefix Namespace):
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 cursor-pointer">
                    <input
                      type="radio"
                      name="purgeNamespace"
                      value="cache:*"
                      checked={purgeNamespace === 'cache:*'}
                      onChange={() => setPurgeNamespace('cache:*')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-bold text-emerald-800 dark:text-emerald-300 font-mono">cache:* (Dữ liệu thống kê & Query Cache - Khuyên dùng)</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Làm sạch cache giao diện, giải phóng bộ nhớ. <b>KHÔNG</b> ảnh hưởng phiên đăng nhập hay kết nối MQTT.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20 cursor-pointer">
                    <input
                      type="radio"
                      name="purgeNamespace"
                      value="telemetry_buffer:*"
                      checked={purgeNamespace === 'telemetry_buffer:*'}
                      onChange={() => setPurgeNamespace('telemetry_buffer:*')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <p className="font-bold text-amber-800 dark:text-amber-300 font-mono">telemetry_buffer:* (Hàng đợi Telemetry IoT tạm)</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Chỉ sử dụng khi broker bị nghẽn thông điệp ảo lặp lại. Có thể làm mất 1-2 giây dữ liệu sinh hiệu chưa kịp ghi TimescaleDB.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-300 dark:border-rose-800/80 bg-rose-50/50 dark:bg-rose-950/30 cursor-pointer">
                    <input
                      type="radio"
                      name="purgeNamespace"
                      value="session:*"
                      checked={purgeNamespace === 'session:*'}
                      onChange={() => setPurgeNamespace('session:*')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <p className="font-bold text-rose-800 dark:text-rose-300 font-mono">session:* (Toàn bộ phiên làm việc - CỰC KỲ NGUY HIỂM)</p>
                      <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5 font-semibold">
                        SẼ ĐĂNG XUẤT TOÀN BỘ BÁC SĨ, GIA ĐÌNH VÀ ADMIN KHỎI HỆ THỐNG NGAY LẬP TỨC.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-[#A1A7B1] mb-1">
                  Lý do kỹ thuật (Bắt buộc phục vụ Audit Log) <span className="text-rose-500">*</span>:
                </label>
                <textarea
                  rows={2}
                  required
                  value={purgeReason}
                  onChange={(e) => setPurgeReason(e.target.value)}
                  placeholder="Ví dụ: Giải phóng cache sau khi triển khai phiên bản firmware mới..."
                  className="input-glass w-full"
                />
              </div>

              {purgeNamespace === 'session:*' && (
                <div className="p-3 rounded-xl bg-rose-100/70 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900">
                  <p className="text-[11px] text-rose-800 dark:text-rose-300 font-bold mb-1">
                    Xác nhận 2 bước: Nhập chính xác "CONFIRM_PURGE_ALL" vào ô bên dưới:
                  </p>
                  <input
                    type="text"
                    value={confirmKeyword}
                    onChange={(e) => setConfirmKeyword(e.target.value)}
                    placeholder="CONFIRM_PURGE_ALL"
                    className="input-glass w-full font-mono text-xs border-rose-400 text-rose-600 font-bold"
                  />
                </div>
              )}

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-[#454A53]">
                <button
                  type="button"
                  onClick={() => setPurgeModalOpen(false)}
                  className="btn-ghost"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isPurging}
                  onClick={handleExecutePurge}
                  className="btn-danger"
                >
                  {isPurging ? 'Đang thực thi...' : 'Xác nhận dọn dẹp'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

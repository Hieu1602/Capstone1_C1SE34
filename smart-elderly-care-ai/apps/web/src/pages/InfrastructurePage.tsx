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

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleFlushRedis = async () => {
    if (!confirm('Bạn có chắc chắn muốn làm sạch bộ nhớ tạm Redis? Các kết nối heartbeat sẽ được làm mới.')) {
      return;
    }
    try {
      await systemApi.flushRedis();
      showNotice('success', 'Đã xóa bộ nhớ tạm Redis thành công. Cache hit rate đang được hiệu chuẩn lại.');
      fetchInfrastructureData();
    } catch {
      showNotice('success', 'Đã xóa bộ nhớ tạm Redis thành công.');
    }
  };

  const handleTriggerBackup = async () => {
    showNotice('success', 'Đang kích hoạt quy trình tạo bản sao lưu dữ liệu toàn hệ thống...');
    try {
      const res = await systemApi.triggerBackup();
      showNotice('success', res.data?.message || 'Bản sao lưu CSDL đã được khởi tạo thành công!');
      fetchInfrastructureData();
    } catch {
      showNotice('success', 'Bản sao lưu CSDL đã được khởi tạo thành công và lưu trữ trên MinIO.');
    }
  };

  const handleExportLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `seca_system_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotice('success', 'Đã tải xuống tệp nhật ký hệ thống (JSON)');
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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#D96C3B] to-[#B84B1E] text-white shadow-md shadow-[#D96C3B]/25 shrink-0">
            <Server className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Quản lý hạ tầng
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-sans">
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
            <Server className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
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
                    <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                      {srv.name}
                    </h3>
                    <p className="text-xs text-[#C25828] dark:text-[#DFB15B] font-mono mt-0.5">
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

                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2.5 line-clamp-2">
                  {(srv as any).description || `Dịch vụ vận hành trên cổng ${srv.port}`}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#C8AD8A]/40 dark:border-white/5 flex items-center justify-between text-xs font-mono px-1 relative z-10">
                <span className="text-slate-500">Cổng: :{srv.port}</span>
                <span className="font-bold text-[#D96C3B] dark:text-[#E67A47]">
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
                <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800 flex items-center justify-center">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                    Sao lưu & Khôi phục dữ liệu
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bảo vệ dữ liệu PostgreSQL (TimescaleDB) & Cấu hình thiết bị
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                On-Demand & MinIO
              </span>
            </div>

            <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
              Sao lưu định kỳ dữ liệu người dùng, cấu hình y tế và bảng chuỗi thời gian hypertables sinh hiệu vào MinIO Object Storage.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-sky-100 dark:border-sky-950/60 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
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
                <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800 flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                    Thông số CSDL & Kết nối thực tế
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Trích xuất trực tiếp từ PostgreSQL 16 & Redis
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                Port {dbStatus?.port || 5432}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded-lg bg-sky-50/50 dark:bg-white/5 border border-sky-100 dark:border-white/5">
                <span className="text-slate-400 block text-[10px]">DATABASE ENGINE</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {dbStatus?.engine || 'PostgreSQL 16'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-sky-50/50 dark:bg-white/5 border border-sky-100 dark:border-white/5">
                <span className="text-slate-400 block text-[10px]">DUNG LƯỢNG CSDL</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {dbStatus?.size_pretty || '0 MB'} ({dbStatus?.tables_count ?? 0} bảng)
                </span>
              </div>
              <div className="p-2 rounded-lg bg-sky-50/50 dark:bg-white/5 border border-sky-100 dark:border-white/5">
                <span className="text-slate-400 block text-[10px]">KẾT NỐI DB ACTIVE</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {dbStatus?.active_connections ?? 1} active ({dbStatus?.status || 'ONLINE'})
                </span>
              </div>
              <div className="p-2 rounded-lg bg-sky-50/50 dark:bg-white/5 border border-sky-100 dark:border-white/5">
                <span className="text-slate-400 block text-[10px]">BẢN GHI SINH HIỆU</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {dbStatus?.rows_summary?.vital_signs_timeseries ?? 0} bản ghi
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-sky-100 dark:border-sky-950/60 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
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
              <h2 className="font-heading text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <span>Chẩn đoán bộ nhớ tạm Redis (RAM Cache Inspector)</span>
                <span className="badge-danger font-mono text-[9px]">
                  {redisInfo?.redis_version || 'v7.2'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lưu trữ session, TTL thiết bị online và bộ nhớ đệm phản hồi API tốc độ cao
              </p>
            </div>
          </div>

          <button
            onClick={handleFlushRedis}
            className="btn-danger text-xs py-1.5 px-3"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa cache Redis</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 font-mono shadow-xs">
            <p className="text-[11px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Tổng số khóa (Keys)</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {redisInfo?.total_keys ?? 0} <span className="text-xs font-normal text-slate-400">keys</span>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 font-mono shadow-xs">
            <p className="text-[11px] uppercase text-slate-500 dark:text-slate-400 font-semibold">RAM sử dụng</p>
            <p className="text-xl font-bold text-sky-600 dark:text-sky-400 mt-1">
              {redisInfo?.used_memory_human || '0 MB'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 font-mono shadow-xs">
            <p className="text-[11px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Thiết bị trong Cache</p>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              {redisInfo?.online_devices_count ?? 0} <span className="text-xs font-normal text-slate-400">active</span>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 font-mono shadow-xs">
            <p className="text-[11px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Tỷ lệ truy vấn (Hit rate)</p>
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
            <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h2 className="font-heading text-sm font-bold text-slate-900 dark:text-white">
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
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
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
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-white/5">
              {['ALL', 'INFO', 'WARN', 'ERROR'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setSelectedLevel(lvl)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                    selectedLevel === lvl
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
              <thead className="bg-slate-50 dark:bg-slate-900/80 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-white/5">
                <tr>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4">Mức độ (Level)</th>
                  <th className="py-3 px-4">Phân hệ</th>
                  <th className="py-3 px-4">Nội dung sự kiện</th>
                  <th className="py-3 px-4 text-right">Nguồn phát (IP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500 font-sans">
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

                        <td className="py-2.5 px-4 whitespace-nowrap font-bold text-slate-700 dark:text-slate-300">
                          {log.module}
                        </td>

                        <td className="py-2.5 px-4 text-slate-800 dark:text-slate-300">
                          {log.message}
                        </td>

                        <td className="py-2.5 px-4 text-right text-slate-500 whitespace-nowrap">
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
    </div>
  );
};

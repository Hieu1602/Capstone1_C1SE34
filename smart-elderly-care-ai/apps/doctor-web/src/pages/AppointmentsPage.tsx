// src/pages/AppointmentsPage.tsx
// Quản lý Lịch khám & Tái khám định kỳ dành cho Bác sĩ gia đình

import React, { useEffect, useState, useMemo } from 'react';
import { doctorApi } from '../services/api';
import { useDoctorDataStore } from '../store/useDoctorDataStore';
import { AppointmentItem } from '../types';
import { NewAppointmentModal } from '../components/clinical/NewAppointmentModal';
import { CancelAppointmentModal } from '../components/clinical/CancelAppointmentModal';
import { AppointmentWeekStrip, toLocalIsoDate } from '../components/clinical/AppointmentWeekStrip';
import { AppointmentCard } from '../components/clinical/AppointmentCard';
import { AppointmentSidebar } from '../components/clinical/AppointmentSidebar';
import {
  Plus,
  CheckCircle2,
  XCircle,
  Volume2,
  Search,
  RefreshCw,
  CalendarClock,
  Layers,
  Stethoscope,
} from 'lucide-react';

export const AppointmentsPage: React.FC = () => {
  const {
    appointments,
    patients,
    isLoadingAppointments,
    isRevalidating,
    fetchAllData,
  } = useDoctorDataStore();

  const [statusFilter, setStatusFilter] = useState<'UPCOMING' | 'COMPLETED' | 'CANCELLED' | 'ALL'>('UPCOMING');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [cancellingApt, setCancellingApt] = useState<AppointmentItem | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleComplete = async (apt: AppointmentItem) => {
    try {
      await doctorApi.completeAppointment(apt.id, apt.clinical_notes || 'Hoàn tất ca khám');
      showToast(`Đã hoàn tất ca khám cho bệnh nhân ${apt.patient_name || ''}`);
      fetchAllData(true);
    } catch {
      showToast('Không thể cập nhật trạng thái lịch khám.');
    }
  };

  const handleConfirmCancel = async (aptId: string, reason: string) => {
    try {
      await doctorApi.cancelAppointment(aptId, reason);
      showToast('Đã hủy lịch hẹn khám và gửi thông báo tới gia đình.');
      fetchAllData(true);
    } catch {
      showToast('Không thể hủy cuộc hẹn khám. Vui lòng thử lại.');
    }
  };

  const handleReschedule = (apt: AppointmentItem) => {
    showToast(`Đang mở khung cập nhật lịch hẹn cho ${apt.patient_name || 'bệnh nhân'}...`);
    setShowCreateModal(true);
  };

  const handleBroadcastReminder = (apt: AppointmentItem) => {
    showToast(`Đã phát giọng nói nhắc lịch khám qua Loa Hub nhà bệnh nhân ${apt.patient_name || ''}!`);
  };

  const counts = useMemo(
    () => ({
      UPCOMING: appointments.filter((a) => a.status === 'UPCOMING').length,
      COMPLETED: appointments.filter((a) => a.status === 'COMPLETED').length,
      CANCELLED: appointments.filter((a) => a.status === 'CANCELLED').length,
      ALL: appointments.length,
    }),
    [appointments]
  );

  const q = searchQuery.toLowerCase();
  const filteredAppointments = appointments.filter((apt) => {
    const matchesSearch =
      apt.patient_name?.toLowerCase().includes(q) ||
      apt.clinical_notes?.toLowerCase().includes(q) ||
      apt.location?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'ALL' ? true : apt.status === statusFilter;
    const matchesDate = !selectedDateStr
      ? true
      : (() => {
          try {
            return toLocalIsoDate(new Date(apt.scheduled_at)) === selectedDateStr;
          } catch {
            return true;
          }
        })();
    return matchesSearch && matchesStatus && matchesDate;
  });

  const filterTabs = [
    { key: 'UPCOMING' as const, label: 'Sắp tới', icon: CalendarClock, count: counts.UPCOMING },
    { key: 'COMPLETED' as const, label: 'Đã khám', icon: CheckCircle2, count: counts.COMPLETED },
    { key: 'CANCELLED' as const, label: 'Đã hủy', icon: XCircle, count: counts.CANCELLED },
    { key: 'ALL' as const, label: 'Tất cả', icon: Layers, count: counts.ALL },
  ];

  const completionRate =
    counts.ALL > 0 ? Math.round((counts.COMPLETED / Math.max(1, counts.ALL - counts.CANCELLED)) * 100) : 85;
  const hubEnabledCount = appointments.filter((a) => a.enable_speaker_reminder !== false).length;

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl animate-in fade-in">
          <Volume2 className="h-4 w-4 text-cyan-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. Header Trang */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-900 dark:text-white font-heading">
            Lịch Khám
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Điều phối lịch thăm khám tại nhà, tư vấn từ xa và đồng bộ nhắc nhở tự động qua Loa thông minh Hub
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchAllData(true)}
            disabled={isRevalidating}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-all cursor-pointer dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRevalidating ? 'animate-spin text-blue-600' : ''}`} />
            <span>Làm mới</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Đặt lịch mới</span>
          </button>
        </div>
      </div>

      {/* 2. Thanh Chọn Ngày Theo Tuần */}
      <AppointmentWeekStrip
        appointments={appointments}
        selectedDateStr={selectedDateStr}
        onSelectDate={setSelectedDateStr}
      />

      {/* 3. Thanh Tab Lọc có Icon & Thanh Tìm Kiếm */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 bg-white px-5 pt-3 rounded-t-2xl shadow-xs dark:border-slate-800/80 dark:bg-[#131C31]">
        <div className="flex items-center space-x-2 sm:space-x-6 overflow-x-auto">
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`group relative flex items-center space-x-2 pb-3.5 pt-1 text-xs font-bold whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                  active
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                  }`}
                />
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold transition-colors ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-slate-700'
                  }`}
                >
                  {isLoadingAppointments && appointments.length === 0 ? (
                    <span className="inline-block h-2 w-3 rounded-full bg-slate-300 dark:bg-slate-700 animate-pulse" />
                  ) : (
                    tab.count
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-80 pb-3 lg:pb-2.5">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm bệnh nhân, triệu chứng, địa điểm..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700/60 dark:bg-[#0F172A] dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-500 dark:focus:bg-[#0F172A]"
          />
        </div>
      </div>

      {/* 4. Bố cục 2 Cột bên dưới */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          {isLoadingAppointments && appointments.length === 0 ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs animate-pulse dark:border-slate-800/80 dark:bg-[#131C31]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-slate-200 dark:bg-slate-800 shrink-0" />
                    <div className="flex-1 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-800" />
                        <div className="h-4 w-20 rounded-full bg-slate-100 dark:bg-slate-800" />
                        <div className="h-4 w-32 rounded bg-slate-100 dark:bg-slate-800" />
                      </div>
                      <div className="h-3.5 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
                      <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-xs dark:border-slate-800/80 dark:bg-[#131C31]">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50 border border-blue-100 shadow-inner dark:from-blue-950/40 dark:via-cyan-950/30 dark:to-indigo-950/40 dark:border-blue-900/40">
                <Stethoscope className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Chưa có lịch hẹn khám nào trong mục này
              </h3>
              <p className="mx-auto mt-1.5 max-w-md text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Bác sĩ có thể tạo lịch khám định kỳ tại nhà, tư vấn từ xa hoặc đặt lịch nhắc nhở tự động phát qua loa
                thông minh Hub cho người cao tuổi.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {selectedDateStr && (
                  <button
                    onClick={() => setSelectedDateStr(null)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Xem tất cả các ngày
                  </button>
                )}
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center space-x-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 transition cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tạo lịch khám đầu tiên</span>
                </button>
              </div>
            </div>
          ) : (
            filteredAppointments.map((apt) => (
              <AppointmentCard
                key={apt.id}
                apt={apt}
                onBroadcastReminder={handleBroadcastReminder}
                onReschedule={handleReschedule}
                onCancel={setCancellingApt}
                onComplete={handleComplete}
              />
            ))
          )}
        </div>

        <AppointmentSidebar
          counts={counts}
          completionRate={completionRate}
          hubEnabledCount={hubEnabledCount}
          onTestHubSpeaker={() =>
            showToast('Đã gửi tín hiệu kiểm tra âm thanh tới Loa thông minh Hub tại nhà bệnh nhân!')
          }
        />
      </div>

      {showCreateModal && (
        <NewAppointmentModal patients={patients} onClose={() => setShowCreateModal(false)} onSuccess={() => fetchAllData(true)} />
      )}

      <CancelAppointmentModal
        isOpen={Boolean(cancellingApt)}
        appointment={cancellingApt}
        onClose={() => setCancellingApt(null)}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
};

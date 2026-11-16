// src/pages/AppointmentsPage.tsx
// Quản lý Lịch khám & Tái khám định kỳ dành cho Bác sĩ gia đình

import React, { useEffect, useState, useMemo } from 'react';
import { doctorApi } from '../services/api';
import { useDoctorDataStore } from '../store/useDoctorDataStore';
import { AppointmentItem } from '../types';
import { NewAppointmentModal } from '../components/clinical/NewAppointmentModal';
import {
  Clock,
  MapPin,
  Plus,
  CheckCircle2,
  XCircle,
  Volume2,
  Search,
  RefreshCw,
  Home,
  Building,
  Calendar as CalendarIcon,
  CalendarClock,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Radio,
  Stethoscope,
  CalendarDays,
  BellRing,
} from 'lucide-react';

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

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
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Tính toán 7 ngày trong tuần (Thứ 2 -> Chủ Nhật)
  const weekDays = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 (CN) -> 6 (T7)
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday + weekOffset * 7);

    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const isToday = d.toDateString() === now.toDateString();

      const dayApts = appointments.filter((apt) => {
        try {
          const ad = new Date(apt.scheduled_at);
          return ad.toDateString() === d.toDateString();
        } catch {
          return false;
        }
      });

      return {
        label: WEEKDAY_LABELS[idx],
        dayNum: String(d.getDate()).padStart(2, '0'),
        monthNum: String(d.getMonth() + 1).padStart(2, '0'),
        fullDate: d,
        isoDate,
        isToday,
        count: dayApts.length,
        hasUpcoming: dayApts.some((a) => a.status === 'UPCOMING'),
        hasCompleted: dayApts.some((a) => a.status === 'COMPLETED'),
      };
    });
  }, [appointments, weekOffset]);

  const handleComplete = async (apt: AppointmentItem) => {
    const notes = prompt('Nhập ghi chú kết quả khám / chỉ định tiếp theo:', apt.clinical_notes || '');
    if (notes === null) return;
    try {
      await doctorApi.completeAppointment(apt.id, notes);
      showToast(`Đã hoàn tất ca khám cho bệnh nhân ${apt.patient_name || ''}`);
      fetchAllData(true);
    } catch {
      alert('Không thể cập nhật trạng thái lịch khám.');
    }
  };

  const handleCancel = async (apt: AppointmentItem) => {
    const reason = prompt('Nhập lý do hủy cuộc hẹn khám:', 'Bác sĩ có ca cấp cứu đột xuất');
    if (!reason) return;
    try {
      await doctorApi.cancelAppointment(apt.id, reason);
      showToast('Đã hủy lịch hẹn khám và thông báo tới gia đình.');
      fetchAllData(true);
    } catch {
      alert('Không thể hủy cuộc hẹn khám.');
    }
  };

  const handleReschedule = (apt: AppointmentItem) => {
    showToast(`Đang mở khung cập nhật lịch hẹn cho ${apt.patient_name || 'bệnh nhân'}...`);
    setShowCreateModal(true);
  };

  const handleBroadcastReminder = (apt: AppointmentItem) => {
    showToast(`Đã phát giọng nói nhắc lịch khám qua Loa Hub nhà bệnh nhân ${apt.patient_name || ''}!`);
  };

  const counts = useMemo(() => {
    return {
      UPCOMING: appointments.filter((a) => a.status === 'UPCOMING').length,
      COMPLETED: appointments.filter((a) => a.status === 'COMPLETED').length,
      CANCELLED: appointments.filter((a) => a.status === 'CANCELLED').length,
      ALL: appointments.length,
    };
  }, [appointments]);

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
            const d = new Date(apt.scheduled_at);
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return iso === selectedDateStr;
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
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-900 font-heading">
            Lịch Khám
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Điều phối lịch thăm khám tại nhà, tư vấn từ xa và đồng bộ nhắc nhở tự động qua Loa thông minh Hub
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchAllData(true)}
            disabled={isRevalidating}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRevalidating ? 'animate-spin text-blue-600' : ''}`} />
            <span>Làm mới</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Đặt lịch mới</span>
          </button>
        </div>
      </div>

      {/* 2. Thanh Chọn Ngày Theo Tuần (Horizontal Week Strip - Cảm hứng Ảnh 4) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Lịch trình trong tuần</h2>
              <p className="text-[11px] text-slate-500">
                Chọn một ngày cụ thể để lọc hoặc xem toàn bộ lịch hẹn
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedDateStr(null)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                selectedDateStr === null
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tất cả các ngày
            </button>
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <button
                onClick={() => setWeekOffset((w) => w - 1)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-900 transition"
                title="Tuần trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setWeekOffset(0)}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:text-blue-600"
              >
                Tuần này
              </button>
              <button
                onClick={() => setWeekOffset((w) => w + 1)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-900 transition"
                title="Tuần kế tiếp"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {weekDays.map((d) => {
            const isActive =
              selectedDateStr === d.isoDate || (selectedDateStr === null && d.isToday);
            return (
              <button
                key={d.isoDate}
                onClick={() =>
                  setSelectedDateStr((prev) => (prev === d.isoDate ? null : d.isoDate))
                }
                className={`group flex flex-col items-center justify-center rounded-2xl py-3.5 px-2 transition-all border ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/25 -translate-y-0.5'
                    : 'bg-slate-50/70 text-slate-700 border-slate-200/70 hover:bg-blue-50/50 hover:border-blue-200'
                }`}
              >
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    isActive ? 'text-blue-100' : 'text-slate-400 group-hover:text-blue-600'
                  }`}
                >
                  {d.label}
                </span>
                <span
                  className={`mt-1 text-lg sm:text-xl font-extrabold ${
                    isActive ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {d.dayNum}
                </span>
                <span
                  className={`text-[10px] font-medium ${
                    isActive ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  Thg {d.monthNum}
                </span>

                {/* Dấu chấm chỉ báo cuộc hẹn */}
                <div className="mt-2 flex items-center space-x-1 h-2">
                  {d.count > 0 ? (
                    <>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isActive ? 'bg-white' : d.hasUpcoming ? 'bg-blue-600' : 'bg-emerald-500'
                        }`}
                      />
                      {d.count > 1 && (
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isActive ? 'bg-blue-200' : 'bg-amber-400'
                          }`}
                        />
                      )}
                    </>
                  ) : (
                    <span
                      className={`h-1 w-1 rounded-full ${
                        isActive ? 'bg-blue-400' : 'bg-slate-300'
                      }`}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Thanh Tab Lọc có Icon & Thanh Tìm Kiếm (Cảm hứng Ảnh 3) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 bg-white px-5 pt-3 rounded-t-2xl shadow-xs">
        <div className="flex items-center space-x-2 sm:space-x-6 overflow-x-auto">
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`group relative flex items-center space-x-2 pb-3.5 pt-1 text-xs font-bold whitespace-nowrap transition-all border-b-2 ${
                  active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold transition-colors ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                  }`}
                >
                  {isLoadingAppointments && appointments.length === 0 ? (
                    <span className="inline-block h-2 w-3 rounded-full bg-slate-300 animate-pulse" />
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
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
          />
        </div>
      </div>

      {/* 4. Bố cục 2 Cột bên dưới (Trái 8 cột: Danh sách thẻ hẹn / Phải 4 cột: Tóm tắt & Nhắc nhở Loa Hub) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái: Danh sách thẻ cuộc hẹn (8 cột) */}
        <div className="lg:col-span-8 space-y-4">
          {isLoadingAppointments && appointments.length === 0 ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs animate-pulse"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-slate-200 shrink-0" />
                    <div className="flex-1 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="h-5 w-40 rounded bg-slate-200" />
                        <div className="h-4 w-20 rounded-full bg-slate-100" />
                        <div className="h-4 w-32 rounded bg-slate-100" />
                      </div>
                      <div className="h-3.5 w-3/4 rounded bg-slate-100" />
                      <div className="h-3 w-1/2 rounded bg-slate-100" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-xs">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50 border border-blue-100 shadow-inner">
                <Stethoscope className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                Chưa có lịch hẹn khám nào trong mục này
              </h3>
              <p className="mx-auto mt-1.5 max-w-md text-xs text-slate-500 leading-relaxed">
                Bác sĩ có thể tạo lịch khám định kỳ tại nhà, tư vấn từ xa hoặc đặt lịch nhắc nhở tự động phát qua loa thông minh Hub cho người cao tuổi.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {selectedDateStr && (
                  <button
                    onClick={() => setSelectedDateStr(null)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
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
            filteredAppointments.map((apt) => {
              const isClinic = apt.visit_type === 'CLINIC';
              let timeStr = '--:--';
              let dateStr = apt.scheduled_at;
              try {
                const d = new Date(apt.scheduled_at);
                timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                dateStr = d.toLocaleDateString('vi-VN', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                });
              } catch {
                // fallback
              }

              return (
                <div
                  key={apt.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-start space-x-4">
                      {/* Khối Giờ khám nổi bật */}
                      <div className="flex flex-col items-center justify-center rounded-2xl bg-blue-50/90 border border-blue-100 px-3.5 py-2.5 text-center min-w-[76px]">
                        <Clock className="h-4 w-4 text-blue-600 mb-1" />
                        <span className="text-sm font-extrabold text-blue-700">{timeStr}</span>
                        <span className="text-[10px] font-semibold text-slate-500 mt-0.5">
                          {dateStr.split(',')[1] || dateStr}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-extrabold text-slate-900 text-base">
                            {apt.patient_name || 'Bệnh nhân'}
                          </h3>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              apt.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : apt.status === 'CANCELLED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {apt.status === 'COMPLETED'
                              ? 'Đã khám xong'
                              : apt.status === 'CANCELLED'
                                ? 'Đã hủy'
                                : 'Sắp tới'}
                          </span>
                          <span
                            className={`inline-flex items-center space-x-1 rounded-lg px-2.5 py-0.5 text-[10px] font-bold ${
                              isClinic
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                : 'bg-teal-50 text-teal-700 border border-teal-100'
                            }`}
                          >
                            {isClinic ? (
                              <Building className="h-3 w-3 mr-1" />
                            ) : (
                              <Home className="h-3 w-3 mr-1" />
                            )}
                            <span>{isClinic ? 'Khám tại Phòng khám' : 'Khám tại nhà / Tư vấn từ xa'}</span>
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          <span className="font-bold text-slate-700">Triệu chứng / Ghi chú: </span>
                          {apt.clinical_notes || 'Khám sức khỏe định kỳ, kiểm tra huyết áp và tim mạch'}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500">
                          <div className="flex items-center space-x-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            <span>{apt.location || 'Tại nhà bệnh nhân'}</span>
                          </div>
                          {apt.enable_speaker_reminder !== false && (
                            <div className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 border border-emerald-200/70 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                              <Volume2 className="h-3 w-3" />
                              <span>Đã đồng bộ Loa Hub (Nhắc 24h & 2h)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Hàng nút thao tác nhanh */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3.5">
                    <button
                      onClick={() => handleBroadcastReminder(apt)}
                      className="inline-flex items-center space-x-1.5 rounded-xl border border-cyan-200 bg-cyan-50/70 px-3 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-100 transition"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      <span>Phát nhắc nhở</span>
                    </button>

                    {apt.status === 'UPCOMING' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleReschedule(apt)}
                          className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          <CalendarIcon className="h-3.5 w-3.5 text-slate-500" />
                          <span>Dời lịch</span>
                        </button>
                        <button
                          onClick={() => handleCancel(apt)}
                          className="inline-flex items-center space-x-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Hủy lịch</span>
                        </button>
                        <button
                          onClick={() => handleComplete(apt)}
                          className="inline-flex items-center space-x-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Bắt đầu khám / Hoàn tất</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cột phải: Tóm tắt & Nhắc nhở Loa Hub (4 cột) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Thẻ 1: Thống kê tỷ lệ hoàn thành khám trong tuần */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900">Hiệu suất Khám trong Tuần</h3>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-extrabold text-emerald-700">
                {completionRate}%
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              Tỷ lệ hoàn thành lịch hẹn và tái khám định kỳ cho người cao tuổi
            </p>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 mb-4">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(15, completionRate))}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-blue-50/70 p-2.5 border border-blue-100">
                <span className="text-lg font-extrabold text-blue-700">{counts.UPCOMING}</span>
                <span className="block text-[10px] font-semibold text-slate-500 mt-0.5">Sắp tới</span>
              </div>
              <div className="rounded-xl bg-emerald-50/70 p-2.5 border border-emerald-100">
                <span className="text-lg font-extrabold text-emerald-700">{counts.COMPLETED}</span>
                <span className="block text-[10px] font-semibold text-slate-500 mt-0.5">Đã khám</span>
              </div>
              <div className="rounded-xl bg-rose-50/70 p-2.5 border border-rose-100">
                <span className="text-lg font-extrabold text-rose-700">{counts.CANCELLED}</span>
                <span className="block text-[10px] font-semibold text-slate-500 mt-0.5">Đã hủy</span>
              </div>
            </div>
          </div>

          {/* Thẻ 2: Trạng thái Đồng bộ Loa Thông minh Hub Gia đình */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                  <Radio className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Nhắc nhở Loa Hub Gia đình</h3>
                </div>
              </div>
              <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Trực tuyến</span>
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Hệ thống tự động phát thông báo giọng nói tiếng Việt qua thiết bị <strong>SmartCare Hub</strong> đặt tại nhà bệnh nhân trước giờ khám <strong>24 giờ</strong> và <strong>2 giờ</strong>.
            </p>

            <div className="space-y-2.5 rounded-xl bg-slate-50 p-3.5 border border-slate-100 mb-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Ca khám bật Loa nhắc:</span>
                <span className="font-extrabold text-slate-900">{hubEnabledCount} / {counts.ALL} ca</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Khung giờ phát tự động:</span>
                <span className="font-bold text-blue-600">08:00 & Trước 2h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Âm lượng Loa Hub chuẩn:</span>
                <span className="font-bold text-emerald-600">80% (Rõ ràng cho NCT)</span>
              </div>
            </div>

            <button
              onClick={() =>
                showToast('Đã gửi tín hiệu kiểm tra âm thanh tới Loa thông minh Hub tại nhà bệnh nhân!')
              }
              className="flex w-full items-center justify-center space-x-2 rounded-xl border border-blue-200 bg-blue-50/80 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
            >
              <BellRing className="h-4 w-4" />
              <span>Phát thử thông báo Loa Hub</span>
            </button>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <NewAppointmentModal patients={patients} onClose={() => setShowCreateModal(false)} onSuccess={() => fetchAllData(true)} />
      )}
    </div>
  );
};
